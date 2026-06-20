import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getToken } from '../utils/auth';

export interface IUser {
  _id: string;
  username: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  address: string;
  role: 'shopOwner' | 'customer' | 'admin';
  password: string;
  shop?: string;
}
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
  category: Category;
}
interface PriceForm {
  name: string;
  charge: string;
  picture: string;
  icon: string;
  category: string;
}

const EMPTY_FORM: PriceForm = { name: '', charge: '', picture: '', icon: '', category: '' };

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

async function apiFetch<T>(path: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? data?.error ?? `Request failed (${res.status})`);
  return data as T;
}

const priceApi = {
  getShop: () => apiFetch<{ data: IUser }>(`/api/shop/price/getShop`, 'GET'),
  getAll: (shopId: string) => apiFetch<{ data: Price[] }>(`/api/shop/price/view/${shopId}`, 'GET'),
  getCategories: () => apiFetch<{ data: Category[] }>(`/api/general/get/categories`, 'GET'),
  add: (shopId: string, body: Omit<PriceForm, 'charge'> & { charge: number }) => apiFetch<{ data: Price }>(`/api/shop/price/add/${shopId}`, 'POST', body),
  update: (shopId: string, priceId: string, body: Omit<PriceForm, 'charge'> & { charge: number }) => apiFetch<{ data: Price }>(`/api/shop/price/update/${shopId}/${priceId}`, 'PUT', body),
  remove: (shopId: string, priceId: string) => apiFetch<{ data: Price }>(`/api/shop/price/delete/${shopId}/${priceId}`, 'DELETE'),
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const IconPlus = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
const IconEdit = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
const IconTrash = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></svg>;
const IconX = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
const IconTag = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>;
const IconRupee = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="6" y1="4" x2="18" y2="4" /><line x1="6" y1="9" x2="18" y2="9" /><polyline points="15 14 6 9" /><path d="M6 4l9 16" /></svg>;
const IconImage = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>;
const IconEmoji = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>;
const IconSpinner = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    style={{ animation: 'spin 0.8s linear infinite' }}>
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
);

// ─── Modal shell ──────────────────────────────────────────────────────────────
function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) {
      document.addEventListener('keydown', h);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', h);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    // Scrollable backdrop layer
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        overflowY: 'auto',
        background: 'rgba(2,9,20,0.80)', backdropFilter: 'blur(5px)',
        animation: 'fadeIn 0.18s ease',
      }}
    >
      {/* Centering shim */}
      <div
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        style={{
          minHeight: '100vh',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px 16px',
        }}
      >
        {/* Dialog card — scrollable with maxHeight */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-xl)',
          width: '100%', maxWidth: 520,
          display: 'flex', flexDirection: 'column',
          boxShadow: 'var(--shadow-xl)',
          animation: 'slideUp 0.24s cubic-bezier(0.34,1.56,0.64,1)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}>
          {/* Header — sticky so it stays visible while scrolling */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '24px 28px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
            position: 'sticky', top: 0, zIndex: 1,
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
          }}>
            <h2 style={{
              margin: 0, fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)',
            }}>
              {title}
            </h2>
            <button
              onClick={onClose}
              style={{
                width: 34, height: 34, borderRadius: 'var(--radius-md)',
                background: 'var(--bg-subtle)', border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-secondary)', transition: 'all var(--ease-fast)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-inset)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-subtle)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
            >
              <IconX />
            </button>
          </div>
          {/* Body */}
          <div style={{ padding: '24px 28px 28px' }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Delete confirm ───────────────────────────────────────────────────────────
function ConfirmDelete({ open, priceName, loading, onClose, onConfirm }: {
  open: boolean; priceName: string; loading: boolean; onClose: () => void; onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(2,9,20,0.80)', backdropFilter: 'blur(5px)',
        padding: 16,
      }}
    >
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-xl)', padding: '32px 28px',
        width: '100%', maxWidth: 400, boxShadow: 'var(--shadow-xl)',
        animation: 'slideUp 0.24s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 'var(--radius-lg)',
          background: 'var(--color-danger-light)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 18, color: 'var(--color-danger)',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            <path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
          </svg>
        </div>
        <h3 style={{ margin: '0 0 10px', fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
          Delete this price?
        </h3>
        <p style={{ margin: '0 0 28px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
          <strong style={{ color: 'var(--text-primary)' }}>"{priceName}"</strong> will be permanently removed and customers won't see it anymore.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} disabled={loading} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="btn btn-danger" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading ? <IconSpinner /> : 'Delete Price'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Image Upload ─────────────────────────────────────────────────────────────
function ImageUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState('');

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setUploadError('File too large — max 5 MB'); return; }
    setUploadError(''); setUploading(true);
    try {
      const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
      const formData = new FormData();
      formData.append('file', file); formData.append('upload_preset', uploadPreset); formData.append('folder', 'manro/prices');
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? 'Upload failed');
      onChange(data.secure_url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="input-group">
      <label className="input-label">Picture</label>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{
          width: 60, height: 60, borderRadius: 'var(--radius-md)',
          background: 'var(--bg-subtle)', border: '1.5px dashed var(--border-default)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', flexShrink: 0,
        }}>
          {uploading ? <IconSpinner />
            : value ? <img src={value} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ color: 'var(--text-tertiary)' }}><IconImage /></span>}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => inputRef.current?.click()} disabled={uploading} style={{ alignSelf: 'flex-start' }}>
            {uploading ? 'Uploading…' : value ? '🔄 Change Image' : '☁️ Upload Image'}
          </button>
          {value && !uploading && (
            <button type="button" onClick={() => onChange('')} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: 'var(--text-xs)', fontWeight: 600, padding: 0 }}>
              ✕ Remove
            </button>
          )}
          <span className="input-hint">JPG, PNG, WebP — max 5 MB</span>
        </div>
      </div>
      {uploadError && <span className="input-hint error">{uploadError}</span>}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  );
}

// ─── FormField ────────────────────────────────────────────────────────────────
interface FormFieldProps {
  id: keyof PriceForm;
  label: string;
  placeholder: string;
  type?: string;
  icon: React.ReactNode;
  value: string;
  error?: string;
  onChange: (f: keyof PriceForm, v: string) => void;
}
function FormField({ id, label, placeholder, type = 'text', icon, value, error, onChange }: FormFieldProps) {
  return (
    <div className="input-group">
      <label className="input-label" htmlFor={id}>{label}</label>
      <div className="input-wrap">
        <span className="input-icon">{icon}</span>
        <input
          id={id} type={type} placeholder={placeholder} value={value}
          onChange={e => onChange(id, e.target.value)}
          className={`input${error ? ' error' : ''}`}
          min={type === 'number' ? '0' : undefined}
          step={type === 'number' ? '0.01' : undefined}
          maxLength={id === 'icon' ? 2 : undefined}
          style={{width:"90%"}}
        />
      </div>
      {error && <span className="input-hint error">{error}</span>}
    </div>
  );
}

// ─── Form fields ──────────────────────────────────────────────────────────────
interface PriceFormFieldsProps {
  form: PriceForm;
  errors: Partial<PriceForm>;
  loading: boolean;
  submitLabel: string;
  categories: string[];
  onChange: (f: keyof PriceForm, v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}
function PriceFormFields({ form, errors, loading, submitLabel, categories, onChange, onSubmit, onCancel }: PriceFormFieldsProps) {
  const filteredCats = categories.filter(c => c.name.toLowerCase().includes(form.category.toLowerCase()));

  // Inline warning: typed value is non-empty but not a valid category
  const categoryTypedInvalid =
  form.category.trim().length > 0 &&
  !categories.some(c => c.name === form.category);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FormField id="name" label="Service Name" placeholder="e.g. Shirt Wash & Iron"
        icon={<IconTag />} value={form.name} error={errors.name} onChange={onChange} />

      {/* Category with datalist */}
      <div className="input-group">
        <label className="input-label">Category</label>

        <select
          value={form.category}
          onChange={(e) => onChange('category', e.target.value)}
          className={`input${errors.category ? ' error' : ''}`}
          style={{ width: "100%" }}
        >
          <option value="">Select Category</option>

          {categories.map((cat) => (
            <option key={cat._id} value={cat._id}>
              {cat.name}
            </option>
          ))}
        </select>

        {errors.category && (
          <span className="input-hint error">
            {errors.category}
          </span>
        )}
      </div>

      <FormField id="charge" label="Charge (₹)" placeholder="e.g. 49.00" type="number"
        icon={<IconRupee />} value={form.charge} error={errors.charge} onChange={onChange} />
      <FormField id="icon" label="Icon (emoji)" placeholder="e.g. 👕"
        icon={<IconEmoji />} value={form.icon} error={errors.icon} onChange={onChange} />
      <ImageUpload value={form.picture} onChange={v => onChange('picture', v)} />

      {/* Live preview */}
      {(form.name || form.icon || form.picture) && (
        <div style={{
          padding: '14px 16px', borderRadius: 'var(--radius-lg)',
          background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', gap: 12, marginTop: 4,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 'var(--radius-md)',
            background: 'var(--bg-inset)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0,
          }}>
            {form.picture
              ? <img src={form.picture} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              : form.icon ? <span style={{ fontSize: 26 }}>{form.icon}</span>
                : <span style={{ color: 'var(--text-tertiary)' }}><IconTag /></span>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {form.name || 'Service name'}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>Preview</div>
          </div>
          <div style={{
            background: 'var(--cyan-500)', color: 'var(--navy-900)',
            borderRadius: 'var(--radius-full)', padding: '4px 12px',
            fontSize: 'var(--text-sm)', fontWeight: 700,
          }}>
            ₹{form.charge || '0.00'}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button onClick={onCancel} disabled={loading} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
        <button onClick={onSubmit} disabled={loading} className="btn btn-primary" style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {loading ? <><IconSpinner /><span>Saving…</span></> : submitLabel}
        </button>
      </div>
    </div>
  );
}

// ─── Price Card ───────────────────────────────────────────────────────────────
function PriceCard({ price, onEdit, onDelete }: { price: Price; onEdit: (p: Price) => void; onDelete: (p: Price) => void }) {
  return (
    <div
      style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)', padding: '16px 18px',
        display: 'flex', alignItems: 'center', gap: 14,
        boxShadow: 'var(--shadow-xs)', transition: 'all var(--ease-normal)',
        position: 'relative', overflow: 'hidden',
      }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = 'var(--shadow-md)'; el.style.borderColor = 'var(--border-default)'; el.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = 'var(--shadow-xs)'; el.style.borderColor = 'var(--border-subtle)'; el.style.transform = 'translateY(0)'; }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--cyan-500)', borderRadius: '0 2px 2px 0', opacity: 0.6 }} />
      <div style={{ width: 50, height: 50, borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
        {price.picture ? <img src={price.picture} alt={price.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : price.icon ? <span style={{ fontSize: 24 }}>{price.icon}</span>
            : <span style={{ color: 'var(--text-tertiary)' }}><IconTag /></span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--text-primary)', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {price.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ background: 'rgba(0,180,216,0.1)', color: 'var(--cyan-500)', borderRadius: 'var(--radius-full)', padding: '2px 10px', fontSize: 'var(--text-xs)', fontWeight: 700, border: '1px solid rgba(0,180,216,0.2)' }}>
            ₹ {Number(price.charge).toFixed(2)}
          </span>
          {price.category && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-full)', padding: '2px 8px', textTransform: 'capitalize' }}>
              {price.category?.name}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {[
          { onClick: () => onEdit(price), title: 'Edit', icon: <IconEdit />, hoverBg: 'var(--navy-800)', hoverColor: 'var(--cyan-300)', hoverBorder: 'var(--navy-600)' },
          { onClick: () => onDelete(price), title: 'Delete', icon: <IconTrash />, hoverBg: 'var(--color-danger-light)', hoverColor: 'var(--color-danger)', hoverBorder: 'var(--color-danger)' },
        ].map(({ onClick, title, icon, hoverBg, hoverColor, hoverBorder }) => (
          <button key={title} onClick={onClick} title={title}
            style={{ width: 34, height: 34, borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)', border: '1px solid var(--border-default)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', transition: 'all var(--ease-fast)' }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = hoverBg; el.style.color = hoverColor; el.style.borderColor = hoverBorder; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--bg-subtle)'; el.style.color = 'var(--text-secondary)'; el.style.borderColor = 'var(--border-default)'; }}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Validation ───────────────────────────────────────────────────────────────
function validateForm(form: PriceForm, categories: Category[]): Partial<PriceForm> {
  const e: Partial<PriceForm> = {};
  if (!form.name.trim()) e.name = 'Service name is required';
  if (!form.charge.trim()) e.charge = 'Charge is required';
  else if (isNaN(Number(form.charge)) || Number(form.charge) < 0) e.charge = 'Enter a valid amount';
  if (!form.category.trim()) e.category = 'Category is required';
 else if (!categories.some(c => c._id === form.category)) e.category = 'Please select a category from the list only.';
  return e;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const PricesPage = () => {
  const [shopId, setShopId] = useState<string | null>(null);
  const [prices, setPrices] = useState<Price[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<PriceForm>(EMPTY_FORM);
  const [addErrors, setAddErrors] = useState<Partial<PriceForm>>({});
  const [addLoading, setAddLoading] = useState(false);

  const [editTarget, setEditTarget] = useState<Price | null>(null);
  const [editForm, setEditForm] = useState<PriceForm>(EMPTY_FORM);
  const [editErrors, setEditErrors] = useState<Partial<PriceForm>>({});
  const [editLoading, setEditLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Price | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchPrices = useCallback(async (id: string) => {
    const res = await priceApi.getAll(id);
    setPrices(res.data ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setApiError('');
      try {
        const userRes = await priceApi.getShop();
        const id = (userRes.data as any).shopId;
        if (!id) throw new Error('No shop linked to this account');
        if (!cancelled) {
          setShopId(id);
          await Promise.all([
            fetchPrices(id),
            priceApi.getCategories().then(res => { if (!cancelled) setCategories(res.data ?? []); }),
          ]);
        }
      } catch (err) {
        if (!cancelled) setApiError(err instanceof Error ? err.message : 'Failed to load shop');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchPrices]);

  function openAdd() { setAddForm(EMPTY_FORM); setAddErrors({}); setAddOpen(true); }

  async function handleAdd() {
    const e = validateForm(addForm, categories);
    if (Object.keys(e).length) { setAddErrors(e); return; }
    setAddLoading(true);
    try {
      if (!shopId) throw new Error('Shop not loaded');
      const res = await priceApi.add(shopId, { ...addForm, charge: Number(addForm.charge) });
      setPrices(p => [...p, res.data]); setAddOpen(false);
    } catch (err) { setAddErrors({ name: err instanceof Error ? err.message : 'Failed to add price' }); }
    finally { setAddLoading(false); }
  }

  function openEdit(price: Price) {
    setEditTarget(price);
    setEditForm({ name: price.name, charge: String(price.charge), picture: price.picture ?? '', icon: price.icon ?? '', category: price.category?._id ?? '' });
    setEditErrors({});
  }

  async function handleEdit() {
    if (!editTarget) return;
    const e = validateForm(editForm, categories);
    if (Object.keys(e).length) { setEditErrors(e); return; }
    setEditLoading(true);
    try {
      if (!shopId) throw new Error('Shop not loaded');
      const res = await priceApi.update(shopId, editTarget._id, { ...editForm, charge: Number(editForm.charge) });
      setPrices(p => p.map(x => x._id === editTarget._id ? res.data : x)); setEditTarget(null);
    } catch (err) { setEditErrors({ name: err instanceof Error ? err.message : 'Failed to update price' }); }
    finally { setEditLoading(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      if (!shopId) throw new Error('Shop not loaded');
      await priceApi.remove(shopId, deleteTarget._id);
      setPrices(p => p.filter(x => x._id !== deleteTarget._id)); setDeleteTarget(null);
    } catch (err) { setApiError(err instanceof Error ? err.message : 'Failed to delete price'); setDeleteTarget(null); }
    finally { setDeleteLoading(false); }
  }

  const handleAddChange = useCallback((field: keyof PriceForm, value: string) => {
    setAddForm(f => ({ ...f, [field]: value }));
    setAddErrors(e => { const n = { ...e }; delete n[field]; return n; });
  }, []);

  const handleEditChange = useCallback((field: keyof PriceForm, value: string) => {
    setEditForm(f => ({ ...f, [field]: value }));
    setEditErrors(e => { const n = { ...e }; delete n[field]; return n; });
  }, []);

  const avgCharge = prices.length ? prices.reduce((s, p) => s + Number(p.charge), 0) / prices.length : 0;
  const maxCharge = prices.length ? Math.max(...prices.map(p => Number(p.charge))) : 0;

  return (
    <>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes cardIn  { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: -600px 0; } 100% { background-position: 600px 0; } }
        .pp-skeleton {
          border-radius: var(--radius-lg);
          background: linear-gradient(90deg, var(--bg-subtle) 25%, var(--bg-inset) 50%, var(--bg-subtle) 75%);
          background-size: 600px 100%;
          animation: shimmer 1.4s infinite;
        }
      `}</style>

      <div style={{  margin: '0 auto' }}>

        {/* ── Page Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, var(--cyan-500), var(--navy-600))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: 'var(--shadow-cyan)' }}>
                <IconTag />
              </div>
              <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
                Service Prices
              </h1>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
              Manage the services and pricing shown to your customers.
            </p>
          </div>
          <button onClick={openAdd} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconPlus /> Add Price
          </button>
        </div>

        {/* ── Error Banner ── */}
        {apiError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'var(--color-danger-light)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-lg)', marginBottom: 20, fontSize: 'var(--text-sm)', color: 'var(--color-danger)', fontWeight: 500 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span style={{ flex: 1 }}>{apiError}</span>
            <button onClick={() => setApiError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}><IconX /></button>
          </div>
        )}

        {/* ── Stats strip ── */}
        {!loading && prices.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Total Services', value: String(prices.length), accent: false },
              { label: 'Avg. Charge', value: `₹${avgCharge.toFixed(0)}`, accent: false },
              { label: 'Highest', value: `₹${maxCharge.toFixed(0)}`, accent: true },
            ].map(({ label, value, accent }, i) => (
              <div key={label} style={{ background: 'var(--bg-surface)', border: `1px solid ${accent ? 'rgba(0,180,216,0.25)' : 'var(--border-subtle)'}`, borderRadius: 'var(--radius-lg)', padding: '16px 18px', boxShadow: 'var(--shadow-xs)', animation: `cardIn 0.3s ease both`, animationDelay: `${i * 60}ms` }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>{label}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 700, color: accent ? 'var(--cyan-500)' : 'var(--text-primary)' }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Skeleton loading ── */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[72, 72, 72, 72].map((h, i) => (
              <div key={i} className="pp-skeleton" style={{ height: h, animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && prices.length === 0 && (
          <div style={{ textAlign: 'center', padding: '72px 24px', background: 'var(--bg-surface)', border: '1.5px dashed var(--border-default)', borderRadius: 'var(--radius-xl)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 48, lineHeight: 1 }}>🏷️</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)', color: 'var(--text-primary)', marginBottom: 6 }}>No prices yet</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>Add your first service price to show customers what you offer.</div>
            </div>
            <button onClick={openAdd} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconPlus /> Add your first price
            </button>
          </div>
        )}

        {/* ── Price list ── */}
        {!loading && prices.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {prices.map((price, i) => (
              <div key={price._id} style={{ animation: `cardIn 0.28s ease both`, animationDelay: `${i * 40}ms` }}>
                <PriceCard price={price} onEdit={openEdit} onDelete={p => setDeleteTarget(p)} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <Modal open={addOpen} title="Add Service Price" onClose={() => setAddOpen(false)}>
        <PriceFormFields
          form={addForm} errors={addErrors} loading={addLoading}
          submitLabel="Add Price" categories={categories}
          onChange={handleAddChange}
          onSubmit={handleAdd} onCancel={() => setAddOpen(false)}
        />
      </Modal>

      <Modal open={!!editTarget} title="Edit Service Price" onClose={() => setEditTarget(null)}>
        <PriceFormFields
          form={editForm} errors={editErrors} loading={editLoading}
          submitLabel="Save Changes" categories={categories}
          onChange={handleEditChange}
          onSubmit={handleEdit} onCancel={() => setEditTarget(null)}
        />
      </Modal>

      <ConfirmDelete
        open={!!deleteTarget} priceName={deleteTarget?.name ?? ''}
        loading={deleteLoading} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
      />
    </>
  );
};

export default PricesPage;