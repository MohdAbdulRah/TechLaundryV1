import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { FormInput } from '../components/FormInput';
import { authApi } from '../utils/api';
import { saveAuth, getDashboardPath } from '../utils/auth';
import type { FieldErrors } from '../types/auth';

// ── Icons ──────────────────────────────────────────────
const IconUser    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IconMail    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
const IconPhone   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.68A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>;
const IconLock    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>;
const IconMap     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const IconArrow   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>;

// ── Left Panel ─────────────────────────────────────────
function SignupPanel() {
  return (
    <>
      <div className="auth-panel-logo">
        <div className="auth-panel-logo-icon">M</div>
        <span className="auth-panel-logo-name">MANRO</span>
      </div>
      <div>
        <p className="auth-panel-tagline">Join the <span>community.</span></p>
        <p className="auth-panel-sub" style={{ marginTop: 12 }}>
          Create a free account and start cleaning your clothes from thousands of verified local and online stores.
        </p>
      </div>
      <div className="auth-panel-features">
        {[
          { icon: '🎁', text: 'Exclusive deals & early access sales' },
          { icon: '🚚', text: 'Track deliveries in real time' },
          { icon: '⭐', text: 'Leave reviews & earn loyalty points' },
          { icon: '🔒', text: 'Secure checkout with buyer protection' },
        ].map(f => (
          <div key={f.text} className="auth-panel-feature">
            <div className="auth-panel-feature-dot">{f.icon}</div>
            <span className="auth-panel-feature-text">{f.text}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 'auto', paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <p style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.3)', margin: 0 }}>
          Are you a LaundryMan?{' '}
          <Link to="/signup/shop-owner" style={{ color: 'var(--cyan-400)', fontWeight: 600 }}>Register as Shop Owner →</Link>
        </p>
      </div>
    </>
  );
}

// ── Validation ─────────────────────────────────────────
function validateForm(form: typeof EMPTY): FieldErrors {
  const e: FieldErrors = {};
  if (!form.firstName.trim())  e.firstName = 'First name is required';
  if (!form.lastName.trim())   e.lastName  = 'Last name is required';
  if (!form.username.trim())   e.username  = 'Username is required';
  else if (form.username.length < 3) e.username = 'Minimum 3 characters';
  if (!form.email.trim())      e.email     = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
  if (!form.phone.trim())      e.phone     = 'Phone number is required';
  if (!form.address.trim())    e.address   = 'Address is required';
  if (!form.password)          e.password  = 'Password is required';
  else if (form.password.length < 8) e.password = 'Minimum 8 characters';
  if (form.confirmPassword !== form.password) e.confirmPassword = 'Passwords do not match';
  return e;
}

const EMPTY = { firstName: '', lastName: '', username: '', email: '', phone: '', address: '', password: '', confirmPassword: '' };

// ── Page ───────────────────────────────────────────────
export default function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setErrors(errs => { const n = { ...errs }; delete n[field]; return n; });
    setApiError('');
  };

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const fieldErrors = validateForm(form);
    if (!agreed) fieldErrors.terms = 'You must accept the terms';
    if (Object.keys(fieldErrors).length) { setErrors(fieldErrors); return; }

    setLoading(true);
    setApiError('');
    try {
      const data = await authApi.signup({
        firstName: form.firstName.trim(),
        lastName:  form.lastName.trim(),
        username:  form.username.trim(),
        email:     form.email.trim().toLowerCase(),
        phone:     form.phone.trim(),
        address:   form.address.trim(),
        password:  form.password,
        role:      'user',
      });
      saveAuth(data);
      navigate(getDashboardPath(data.user.role), { replace: true });
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Sign-up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout panel={<SignupPanel />}>
      <div className="auth-form-box">
        <div className="auth-form-header">
          <h1 className="auth-form-title">Create account</h1>
          <p className="auth-form-subtitle">Fill in the details below — it only takes a minute.</p>
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
            {/* Name row */}
            <div className="auth-form-row">
              <FormInput id="firstName" label="First Name" placeholder="Jane" value={form.firstName} onChange={set('firstName')} error={errors.firstName} required icon={<IconUser />} autoComplete="given-name" />
              <FormInput id="lastName"  label="Last Name"  placeholder="Doe"  value={form.lastName}  onChange={set('lastName')}  error={errors.lastName}  required icon={<IconUser />} autoComplete="family-name" />
            </div>

            <FormInput id="username" label="Username" placeholder="janedoe123" value={form.username} onChange={set('username')} error={errors.username} required icon={<IconUser />} autoComplete="username" hint="3+ characters, used for login" />

            <FormInput id="email" label="Email Address" type="email" placeholder="jane@example.com" value={form.email} onChange={set('email')} error={errors.email} required icon={<IconMail />} autoComplete="email" />

            <FormInput id="phone" label="Phone Number" type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={set('phone')} error={errors.phone} required icon={<IconPhone />} autoComplete="tel" />

            <FormInput id="address" label="Address" placeholder="123 Main St, City, State" value={form.address} onChange={set('address')} error={errors.address} required icon={<IconMap />} autoComplete="street-address" />

            <div className="auth-form-row">
              <FormInput id="password"        label="Password"         type="password" placeholder="Min. 8 characters"  value={form.password}        onChange={set('password')}        error={errors.password}        required icon={<IconLock />} autoComplete="new-password" />
              <FormInput id="confirmPassword" label="Confirm Password" type="password" placeholder="Repeat password"    value={form.confirmPassword} onChange={set('confirmPassword')} error={errors.confirmPassword} required icon={<IconLock />} autoComplete="new-password" />
            </div>

            {/* Terms */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label className="checkbox-wrap" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={agreed} onChange={e => { setAgreed(e.target.checked); setErrors(errs => { const n = { ...errs }; delete n.terms; return n; }); }} />
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                  I agree to the{' '}
                  <Link to="/terms" style={{ color: 'var(--text-link)', fontWeight: 600 }}>Terms of Service</Link>
                  {' '}and{' '}
                  <Link to="/privacy" style={{ color: 'var(--text-link)', fontWeight: 600 }}>Privacy Policy</Link>
                </span>
              </label>
              {errors.terms && <span className="input-hint error">{errors.terms}</span>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`btn btn-primary btn-lg btn-block${loading ? ' btn-loading' : ''}`}
              style={{ marginTop: 4 }}
            >
              {!loading && <><span>Create Account</span><IconArrow /></>}
              {loading && <span>Creating account…</span>}
            </button>
          </div>
        </form>

        <div className="auth-form-footer" style={{ marginTop: 24 }}>
          <p style={{ margin: 0 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--text-link)', fontWeight: 'var(--weight-semibold)' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}