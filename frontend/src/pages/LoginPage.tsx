import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { FormInput } from '../components/FormInput';
import { authApi } from '../utils/api';
import { saveAuth, getDashboardPath } from '../utils/auth';
import type { FieldErrors } from '../types/auth';

// ── Icons ──────────────────────────────────────────────
const IconUser = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconLock = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>
);
const IconArrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);

// ── Left Panel Content ─────────────────────────────────
function LoginPanel() {
  return (
    <>
      <div className="auth-panel-logo">
        <div className="auth-panel-logo-icon">M</div>
        <span className="auth-panel-logo-name">MANRO</span>
      </div>

      <div>
        <p className="auth-panel-tagline">
          Welcome <span>back.</span>
        </p>
        <p className="auth-panel-sub" style={{ marginTop: 12 }}>
          Sign in to manage your account, track orders, and explore thousands of shops.
        </p>
      </div>

      <div className="auth-panel-features">
        {[
          { icon: '🛒', text: 'Browse & DryClean from verified shops' },
          { icon: '📦', text: 'Real-time order tracking & history' },
          { icon: '💬', text: 'Message shop owners directly' },
        ].map(f => (
          <div key={f.text} className="auth-panel-feature">
            <div className="auth-panel-feature-dot">{f.icon}</div>
            <span className="auth-panel-feature-text">{f.text}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <p style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.3)', margin: 0 }}>
          Don't have an account?{' '}
          <Link to="/signup" style={{ color: 'var(--cyan-400)', fontWeight: 600 }}>
            Sign up free
          </Link>
        </p>
      </div>
    </>
  );
}

// ── Page ───────────────────────────────────────────────
export default function LoginPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setErrors(errs => { const n = { ...errs }; delete n[field]; return n; });
    setApiError('');
  };

  function validate(): boolean {
    const e: FieldErrors = {};
    if (!form.identifier.trim()) e.identifier = 'Username or email is required';
    if (!form.password)          e.password   = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setApiError('');

    try {
      const data = await authApi.login({
        identifier: form.identifier.trim(),
        password:   form.password,
      });

      saveAuth(data);
      navigate(getDashboardPath(data.user.role), { replace: true });
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout panel={<LoginPanel />}>
      <div className="auth-form-box">
        <div className="auth-form-header">
          <h1 className="auth-form-title">Sign in</h1>
          <p className="auth-form-subtitle">Enter your credentials to access your account.</p>
        </div>

        {apiError && (
          <div className="alert alert-danger" style={{ marginBottom: 20 }} role="alert">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{apiError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="auth-form-fields">
            <FormInput
              id="identifier"
              label="Username or Email"
              type="text"
              placeholder="you@example.com or yourhandle"
              value={form.identifier}
              onChange={set('identifier')}
              error={errors.identifier}
              autoComplete="username"
              required
              icon={<IconUser />}
            />

            <FormInput
              id="password"
              label="Password"
              type="password"
              placeholder="Enter your password"
              value={form.password}
              onChange={set('password')}
              error={errors.password}
              autoComplete="current-password"
              required
              icon={<IconLock />}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -8 }}>
              <Link
                to="/forgot-password"
                style={{ fontSize: 'var(--text-sm)', color: 'var(--text-link)', fontWeight: 'var(--weight-medium)' }}
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`btn btn-primary btn-lg btn-block${loading ? ' btn-loading' : ''}`}
              style={{ marginTop: 8 }}
            >
              {!loading && <><span>Sign In</span><IconArrow /></>}
              {loading && <span>Signing in…</span>}
            </button>
          </div>
        </form>

        <div className="divider-label" style={{ margin: '28px 0' }}>or</div>

        <div className="auth-form-footer">
          <p style={{ margin: 0 }}>
            New to Marketplace?{' '}
            <Link to="/signup" style={{ color: 'var(--text-link)', fontWeight: 'var(--weight-semibold)' }}>
              Create an account
            </Link>
          </p>
          <p style={{ margin: 0 }}>
            Own a shop?{' '}
            <Link to="/signup/shop-owner" style={{ color: 'var(--cyan-600)', fontWeight: 'var(--weight-semibold)' }}>
              Register as Shop Owner →
            </Link>
          </p>
          <p style={{ margin: 0 }}>
            Want to Deliver?{' '}
            <Link to="/signup/delivery-boy" style={{ color: 'var(--cyan-600)', fontWeight: 'var(--weight-semibold)' }}>
              Register as Delivery Boy →
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}