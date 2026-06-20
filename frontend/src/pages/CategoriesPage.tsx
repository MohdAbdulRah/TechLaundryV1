import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getToken } from '../utils/auth';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Category {
  _id: string;
  name: string;
  createdAt: string;
}

interface CategoryForm {
  name: string;
}
const EMPTY_FORM: CategoryForm = { name: '' };

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

// ─── API ──────────────────────────────────────────────────────────────────────
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

const categoryApi = {
  getAll: () => apiFetch<{ data: Category[] }>(`/api/admin/category/all`, 'GET'),
  add: (body: CategoryForm) => apiFetch<{ data: Category }>(`/api/admin/category/add`, 'POST', body),
  update: (id: string, body: CategoryForm) => apiFetch<{ data: Category }>(`/api/admin/category/edit/${id}`, 'PUT', body),
  remove: (id: string) => apiFetch<{ message: string }>(`/api/admin/category/delete/${id}`, 'DELETE'),
};

// ─── Icons ────────────────────────────────────────────────────────────────────
const IconPlus = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
const IconEdit = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
const IconTrash = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></svg>;
const IconX = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
const IconFolder = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>;
const IconSearch = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
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
      <div
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        style={{
          minHeight: '100vh',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px 16px',
        }}
      >
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-xl)',
          width: '100%', maxWidth: 480,
          display: 'flex', flexDirection: 'column',
          boxShadow: 'var(--shadow-xl)',
          animation: 'slideUp 0.24s cubic-bezier(0.34,1.56,0.64,1)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}>
          {/* Header */}
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
function ConfirmDelete({ open, categoryName, loading, onClose, onConfirm }: {
  open: boolean; categoryName: string; loading: boolean; onClose: () => void; onConfirm: () => void;
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
          Delete this category?
        </h3>
        <p style={{ margin: '0 0 28px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
          <strong style={{ color: 'var(--text-primary)' }}>"{categoryName}"</strong> will be permanently removed. Any prices using this category may be affected.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} disabled={loading} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="btn btn-danger" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {loading ? <IconSpinner /> : 'Delete Category'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Validation ───────────────────────────────────────────────────────────────
function validateForm(form: CategoryForm): Partial<CategoryForm> {
  const e: Partial<CategoryForm> = {};
  if (!form.name.trim()) e.name = 'Category name is required';
  else if (form.name.trim().length < 2) e.name = 'Name must be at least 2 characters';
  return e;
}

// ─── Category Form Fields ─────────────────────────────────────────────────────
interface CategoryFormFieldsProps {
  form: CategoryForm;
  errors: Partial<CategoryForm>;
  loading: boolean;
  submitLabel: string;
  onChange: (f: keyof CategoryForm, v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}
function CategoryFormFields({ form, errors, loading, submitLabel, onChange, onSubmit, onCancel }: CategoryFormFieldsProps) {
  // Submit on Enter
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !loading) onSubmit();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="input-group">
        <label className="input-label" htmlFor="cat-name">Category Name</label>
        <div className="input-wrap">
          <span className="input-icon"><IconFolder /></span>
          <input
            id="cat-name"
            type="text"
            placeholder="e.g. Laundry, Dry Cleaning…"
            value={form.name}
            onChange={e => onChange('name', e.target.value)}
            onKeyDown={handleKeyDown}
            className={`input${errors.name ? ' error' : ''}`}
            autoFocus
            style={{ width: '90%' }}
          />
        </div>
        {errors.name && <span className="input-hint error">{errors.name}</span>}
        <span className="input-hint">This will be visible to customers as a filter.</span>
      </div>

      {/* Live preview */}
      {form.name.trim() && (
        <div style={{
          padding: '12px 16px', borderRadius: 'var(--radius-lg)',
          background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', gap: 10, marginTop: 4,
        }}>
          <span style={{ color: 'var(--cyan-500)' }}><IconFolder /></span>
          <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
            {form.name.trim().replaceAll('_', ' ')}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Preview</span>
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

// ─── Category Card ────────────────────────────────────────────────────────────
function CategoryCard({
  category, index, onEdit, onDelete,
}: {
  category: Category; index: number; onEdit: (c: Category) => void; onDelete: (c: Category) => void;
}) {
  const createdDate = new Date(category.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <div
      style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)', padding: '16px 18px',
        display: 'flex', alignItems: 'center', gap: 14,
        boxShadow: 'var(--shadow-xs)', transition: 'all var(--ease-normal)',
        position: 'relative', overflow: 'hidden',
        animation: 'cardIn 0.28s ease both',
        animationDelay: `${index * 40}ms`,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = 'var(--shadow-md)';
        el.style.borderColor = 'var(--border-default)';
        el.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = 'var(--shadow-xs)';
        el.style.borderColor = 'var(--border-subtle)';
        el.style.transform = 'translateY(0)';
      }}
    >
      {/* Left accent bar */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
        background: 'var(--cyan-500)', borderRadius: '0 2px 2px 0', opacity: 0.6,
      }} />

      {/* Icon */}
      <div style={{
        width: 44, height: 44, borderRadius: 'var(--radius-md)',
        background: 'rgba(0,180,216,0.08)', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid rgba(0,180,216,0.15)', color: 'var(--cyan-500)',
      }}>
        <IconFolder />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--text-primary)',
          marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          textTransform: 'capitalize',
        }}>
          {category.name.replaceAll('_', ' ')}
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
          Added {createdDate}
        </div>
      </div>

      {/* Index badge */}
      <span style={{
        background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-full)', padding: '2px 10px',
        fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 600,
        flexShrink: 0,
      }}>
        #{index + 1}
      </span>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {[
          { onClick: () => onEdit(category), title: 'Edit', icon: <IconEdit />, hoverBg: 'var(--navy-800)', hoverColor: 'var(--cyan-300)', hoverBorder: 'var(--navy-600)' },
          { onClick: () => onDelete(category), title: 'Delete', icon: <IconTrash />, hoverBg: 'var(--color-danger-light)', hoverColor: 'var(--color-danger)', hoverBorder: 'var(--color-danger)' },
        ].map(({ onClick, title, icon, hoverBg, hoverColor, hoverBorder }) => (
          <button key={title} onClick={onClick} title={title}
            style={{
              width: 34, height: 34, borderRadius: 'var(--radius-md)',
              background: 'var(--bg-subtle)', border: '1px solid var(--border-default)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-secondary)', transition: 'all var(--ease-fast)',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = hoverBg; el.style.color = hoverColor; el.style.borderColor = hoverBorder;
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = 'var(--bg-subtle)'; el.style.color = 'var(--text-secondary)'; el.style.borderColor = 'var(--border-default)';
            }}
          >
            {icon}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const CategoriesPage = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
  const [search, setSearch] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<CategoryForm>(EMPTY_FORM);
  const [addErrors, setAddErrors] = useState<Partial<CategoryForm>>({});
  const [addLoading, setAddLoading] = useState(false);

  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [editForm, setEditForm] = useState<CategoryForm>(EMPTY_FORM);
  const [editErrors, setEditErrors] = useState<Partial<CategoryForm>>({});
  const [editLoading, setEditLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Fetch ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setApiError('');
      try {
        const res = await categoryApi.getAll();
        if (!cancelled) setCategories(res.data ?? []);
      } catch (err) {
        if (!cancelled) setApiError(err instanceof Error ? err.message : 'Failed to load categories');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Add ──
  function openAdd() { setAddForm(EMPTY_FORM); setAddErrors({}); setAddOpen(true); }

  async function handleAdd() {
    const e = validateForm(addForm);
    if (Object.keys(e).length) { setAddErrors(e); return; }
    setAddLoading(true);
    try {
      const res = await categoryApi.add({ name: addForm.name.trim() });
      setCategories(c => [res.data, ...c]);
      setAddOpen(false);
    } catch (err) {
      setAddErrors({ name: err instanceof Error ? err.message : 'Failed to add category' });
    } finally { setAddLoading(false); }
  }

  // ── Edit ──
  function openEdit(cat: Category) {
    setEditTarget(cat);
    setEditForm({ name: cat.name });
    setEditErrors({});
  }

  async function handleEdit() {
    if (!editTarget) return;
    const e = validateForm(editForm);
    if (Object.keys(e).length) { setEditErrors(e); return; }
    setEditLoading(true);
    try {
      const res = await categoryApi.update(editTarget._id, { name: editForm.name.trim() });
      setCategories(c => c.map(x => x._id === editTarget._id ? res.data : x));
      setEditTarget(null);
    } catch (err) {
      setEditErrors({ name: err instanceof Error ? err.message : 'Failed to update category' });
    } finally { setEditLoading(false); }
  }

  // ── Delete ──
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await categoryApi.remove(deleteTarget._id);
      setCategories(c => c.filter(x => x._id !== deleteTarget._id));
      setDeleteTarget(null);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to delete category');
      setDeleteTarget(null);
    } finally { setDeleteLoading(false); }
  }

  // ── Change handlers ──
  const handleAddChange = useCallback((field: keyof CategoryForm, value: string) => {
    setAddForm(f => ({ ...f, [field]: value }));
    setAddErrors(e => { const n = { ...e }; delete n[field]; return n; });
  }, []);

  const handleEditChange = useCallback((field: keyof CategoryForm, value: string) => {
    setEditForm(f => ({ ...f, [field]: value }));
    setEditErrors(e => { const n = { ...e }; delete n[field]; return n; });
  }, []);

  // ── Filtered list ──
  const filtered = search.trim()
    ? categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase().trim()))
    : categories;

  return (
    <>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes cardIn  { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: -600px 0; } 100% { background-position: 600px 0; } }
        .cp-skeleton {
          border-radius: var(--radius-lg);
          background: linear-gradient(90deg, var(--bg-subtle) 25%, var(--bg-inset) 50%, var(--bg-subtle) 75%);
          background-size: 600px 100%;
          animation: shimmer 1.4s infinite;
        }
      `}</style>

      <div style={{ padding: '32px 24px 64px', maxWidth: 800, margin: '0 auto' }}>

        {/* ── Page Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, var(--cyan-500), var(--navy-600))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', boxShadow: 'var(--shadow-cyan)',
              }}>
                <IconFolder />
              </div>
              <h1 style={{
                margin: 0, fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)',
              }}>
                Price Categories
              </h1>
            </div>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
              Organise services into categories shown on your pricing list.
            </p>
          </div>
          <button onClick={openAdd} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconPlus /> Add Category
          </button>
        </div>

        {/* ── Error Banner ── */}
        {apiError && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
            background: 'var(--color-danger-light)', border: '1px solid var(--color-danger)',
            borderRadius: 'var(--radius-lg)', marginBottom: 20,
            fontSize: 'var(--text-sm)', color: 'var(--color-danger)', fontWeight: 500,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span style={{ flex: 1 }}>{apiError}</span>
            <button onClick={() => setApiError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex' }}>
              <IconX />
            </button>
          </div>
        )}

        {/* ── Stats strip ── */}
        {!loading && categories.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Total Categories', value: String(categories.length) },
              {
                label: 'Latest Added',
                value: categories[0]?.name.replaceAll('_', ' ') ?? '—',
                small: true,
              },
            ].map(({ label, value, small }, i) => (
              <div key={label} style={{
                background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)', padding: '16px 18px',
                boxShadow: 'var(--shadow-xs)', animation: 'cardIn 0.3s ease both',
                animationDelay: `${i * 60}ms`,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 8 }}>
                  {label}
                </div>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: small ? 'var(--text-lg)' : 'var(--text-2xl)',
                  fontWeight: 700, color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  textTransform: 'capitalize',
                }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Search bar (only shown when there are categories) ── */}
        {!loading && categories.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div className="input-wrap" style={{ maxWidth: 340 }}>
              <span className="input-icon"><IconSearch /></span>
              <input
                type="text"
                placeholder="Search categories…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input"
                style={{ width: '90%' }}
              />
            </div>
          </div>
        )}

        {/* ── Skeleton loading ── */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[72, 72, 72, 72].map((h, i) => (
              <div key={i} className="cp-skeleton" style={{ height: h, animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && categories.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '72px 24px',
            background: 'var(--bg-surface)', border: '1.5px dashed var(--border-default)',
            borderRadius: 'var(--radius-xl)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          }}>
            <div style={{ fontSize: 48, lineHeight: 1 }}>🗂️</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)', color: 'var(--text-primary)', marginBottom: 6 }}>No categories yet</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                Create categories to organise your services for customers.
              </div>
            </div>
            <button onClick={openAdd} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconPlus /> Add your first category
            </button>
          </div>
        )}

        {/* ── No search results ── */}
        {!loading && categories.length > 0 && filtered.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '40px 24px',
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl)',
          }}>
            <div style={{ fontSize: 36, lineHeight: 1, marginBottom: 12 }}>🔍</div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>No results for "{search}"</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>Try a different search term.</div>
          </div>
        )}

        {/* ── Category list ── */}
        {!loading && filtered.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((cat, i) => (
              <CategoryCard
                key={cat._id}
                category={cat}
                index={i}
                onEdit={openEdit}
                onDelete={c => setDeleteTarget(c)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <Modal open={addOpen} title="Add Category" onClose={() => setAddOpen(false)}>
        <CategoryFormFields
          form={addForm} errors={addErrors} loading={addLoading}
          submitLabel="Add Category"
          onChange={handleAddChange}
          onSubmit={handleAdd} onCancel={() => setAddOpen(false)}
        />
      </Modal>

      <Modal open={!!editTarget} title="Edit Category" onClose={() => setEditTarget(null)}>
        <CategoryFormFields
          form={editForm} errors={editErrors} loading={editLoading}
          submitLabel="Save Changes"
          onChange={handleEditChange}
          onSubmit={handleEdit} onCancel={() => setEditTarget(null)}
        />
      </Modal>

      <ConfirmDelete
        open={!!deleteTarget}
        categoryName={deleteTarget?.name ?? ''}
        loading={deleteLoading}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </>
  );
};

export default CategoriesPage;