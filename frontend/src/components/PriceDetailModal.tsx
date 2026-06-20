import React from "react";
import { useCart } from "../context/CartContext";
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


// ─── Detail Modal ────────────────────────────────────────────────────────────
function PriceDetailModal({ item, onClose }: { item: SelectedItem; onClose: () => void }) {
  const { price, shop } = item;
  const {
  addToCart,
  updateCart,
  getQuantity
} = useCart();

const quantity = getQuantity(price._id,shop._id);
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(2,9,20,0.75)', backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.18s ease',
        padding: '16px',
      }}
    >
      <div style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-xl)',
        width: '100%', maxWidth: 440,
        boxShadow: 'var(--shadow-xl)',
        overflow: 'hidden',
        animation: 'slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1)',
      }}>

        {/* Image banner */}
        <div style={{
          width: '100%', height: 180,
          background: 'var(--bg-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', position: 'relative',
        }}>
          {price.picture ? (
            <img
              src={price.picture}
              alt={price.name}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onError={e => {
                const parent = (e.target as HTMLImageElement).parentElement!;
                (e.target as HTMLImageElement).style.display = 'none';
                parent.innerHTML = price.icon
                  ? `<span style="font-size:56px">${price.icon}</span>`
                  : `<span style="font-size:48px">🏷️</span>`;
              }}
            />
          ) : price.icon ? (
            <span style={{ fontSize: 56 }}>{price.icon}</span>
          ) : (
            <span style={{ fontSize: 48 }}>🏷️</span>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 12, right: 12,
              width: 32, height: 32, borderRadius: 'var(--radius-md)',
              background: 'rgba(2,9,20,0.6)', border: 'none',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', backdropFilter: 'blur(4px)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px 24px 28px' }}>

          {/* Service info */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
              <h2 style={{
                margin: 0, fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)',
              }}>
                {price.name}
              </h2>
              <div style={{
                flexShrink: 0,
                background: 'var(--cyan-500)', color: 'var(--navy-900)',
                borderRadius: 'var(--radius-full)', padding: '4px 14px',
                fontSize: 'var(--text-base)', fontWeight: 700,
                boxShadow: 'var(--shadow-cyan)',
              }}>
                ₹{Number(price.charge).toFixed(2)}
              </div>
            </div>
            <span style={{
              fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)',
              background: 'var(--bg-subtle)', borderRadius: 'var(--radius-full)',
              padding: '2px 10px',
            }}>
              Service Charge
            </span>
          </div>
          {price.category && (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 'var(--text-xs)',
      color: 'var(--text-secondary)',
      background: 'var(--bg-subtle)',
      borderRadius: 'var(--radius-full)',
      padding: '6px 12px',
      marginTop: 6,
      width: 'fit-content',
      textTransform: 'capitalize',
      border: '1px solid var(--border-subtle)',
    }}
  >
    {price.category?.name}
  </div>
)}
          <div style={{ marginTop: 20 }}>

            {quantity === 0 ? (

              <button
                onClick={() => addToCart(price._id,shop._id)}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  height: 46,
                  fontWeight: 700
                }}
              >
                Add To Cart
              </button>

            ) : (

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12
                }}
              >

                <button
                  onClick={() =>
                    updateCart(
                      price._id,
                      shop._id,
                      quantity - 1
                    )
                  }
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: '50%',
                    border: 'none',
                    background: 'var(--bg-subtle)',
                    cursor: 'pointer',
                    fontSize: 22,
                    fontWeight: 700
                  }}
                >
                  -
                </button>

                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    minWidth: 40,
                    textAlign: 'center'
                  }}
                >
                  {quantity}
                </div>

                <button
                  onClick={() =>
                    updateCart(
                      price._id,
                      shop._id,
                      quantity + 1
                    )
                  }
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: '50%',
                    border: 'none',
                    background: 'var(--cyan-500)',
                    color: '#000',
                    cursor: 'pointer',
                    fontSize: 22,
                    fontWeight: 700
                  }}
                >
                  +
                </button>

              </div>

            )}

          </div>
          {/* Divider */}
          <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: 20 }} />

          {/* Shop info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Shop Details
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 'var(--radius-md)',
                background: 'var(--navy-800)', color: 'var(--cyan-300)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--text-base)',
                flexShrink: 0,
              }}>
                {shop?.name?.slice(0, 2)?.toUpperCase() || 'SH'}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--text-primary)' }}>
                  {shop.name}
                </div>
                {shop.address && (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    📍 {shop.address}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


export default PriceDetailModal;