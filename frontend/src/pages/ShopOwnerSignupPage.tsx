import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { FormInput } from '../components/FormInput';
import { authApi,shopApi } from '../utils/api';
import { saveAuth, getDashboardPath } from '../utils/auth';
import type { FieldErrors } from '../types/auth';
import 'leaflet/dist/leaflet.css';
import 'leaflet-geosearch/dist/geosearch.css'; // ← add this
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { GeoSearchControl, OpenStreetMapProvider } from 'leaflet-geosearch';
import { useEffect } from 'react';

delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});
// ── Icons ──────────────────────────────────────────────
const IconUser  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IconMail  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>;
const IconPhone = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.68A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>;
const IconLock  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>;
const IconMap   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const IconStore = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const IconArrow = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>;

// ── Steps progress bar ─────────────────────────────────
interface StepBarProps { current: number; total: number; labels: string[] }
function StepBar({ current, total, labels }: StepBarProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
      {Array.from({ length: total }).map((_, i) => (
        <React.Fragment key={i}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 'var(--text-xs)', fontWeight: 700,
              background: i < current ? 'var(--cyan-500)' : i === current ? 'var(--navy-800)' : 'var(--bg-subtle)',
              color: i < current ? 'var(--navy-900)' : i === current ? '#fff' : 'var(--text-tertiary)',
              border: i === current ? '2px solid var(--cyan-500)' : i < current ? 'none' : '1.5px solid var(--border-default)',
              transition: 'all 0.3s ease',
            }}>
              {i < current ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
              ) : i + 1}
            </div>
            <span style={{ fontSize: 10, color: i === current ? 'var(--text-primary)' : 'var(--text-tertiary)', fontWeight: i === current ? 600 : 400, whiteSpace: 'nowrap' }}>
              {labels[i]}
            </span>
          </div>
          {i < total - 1 && (
            <div style={{ flex: 1, height: 2, background: i < current ? 'var(--cyan-500)' : 'var(--border-default)', margin: '0 6px', marginBottom: 22, transition: 'background 0.3s ease' }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Left Panel ─────────────────────────────────────────
function ShopOwnerPanel() {
  return (
    <>
      <div className="auth-panel-logo">
        <div className="auth-panel-logo-icon" style={{ background: 'var(--cyan-400)' }}>🏪</div>
        <span className="auth-panel-logo-name">MANRO</span>
      </div>

      <div>
        <p className="auth-panel-tagline">
          Sell smarter. <span>Grow faster.</span>
        </p>
        <p className="auth-panel-sub" style={{ marginTop: 12 }}>
          Join thousands of shop owners who use our platform to reach more customers and streamline their operations.
        </p>
      </div>

      <div className="auth-panel-features">
        {[
          { icon: '📊', text: 'Powerful analytics & sales dashboard' },
          { icon: '🛍️', text: 'Manage products, inventory & orders' },
          { icon: '💳', text: 'Fast, secure payments & payouts' },
          { icon: '📣', text: 'Built-in marketing & promotions tools' },
        ].map(f => (
          <div key={f.text} className="auth-panel-feature">
            <div className="auth-panel-feature-dot">{f.icon}</div>
            <span className="auth-panel-feature-text">{f.text}</span>
          </div>
        ))}
      </div>

      <div style={{ background: 'rgba(0,180,216,0.08)', border: '1px solid rgba(0,180,216,0.2)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginTop: 8 }}>
        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.6)' }}>
          🎉 <strong style={{ color: 'var(--cyan-300)' }}>Free for 30 days</strong> — No credit card required. Cancel anytime.
        </p>
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <p style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.3)', margin: 0 }}>
          Washing for yourself?{' '}
          <Link to="/signup" style={{ color: 'var(--cyan-400)', fontWeight: 600 }}>Create a buyer account</Link>
        </p>
      </div>
    </>
  );
}

// ── Validation helpers ─────────────────────────────────
type FormState = {
  firstName: string; lastName: string; username: string;
  email: string; phone: string; address: string;
  password: string; confirmPassword: string;
  // ── NEW ──
  shopName: string; 
  shopLocation: {
  type: 'Point';
  coordinates: [number, number];
} | null;

shopLocationText: string;
};

const EMPTY: FormState = {
  firstName: '', lastName: '', username: '', email: '',
  phone: '', address: '', password: '', confirmPassword: '',
  // ── NEW ──
  shopName: '', 
 shopLocation: null,
shopLocationText: '',
};
function validateStep1(f: FormState): FieldErrors {
  const e: FieldErrors = {};
  if (!f.firstName.trim()) e.firstName = 'First name is required';
  if (!f.lastName.trim())  e.lastName  = 'Last name is required';
  if (!f.username.trim())  e.username  = 'Username is required';
  else if (f.username.length < 3) e.username = 'Minimum 3 characters';
  if (!f.email.trim())     e.email     = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e.email = 'Enter a valid email';
  return e;
}

function validateStep2(f: FormState): FieldErrors {
  const e: FieldErrors = {};
  if (!f.phone.trim())        e.phone        = 'Phone number is required';
  if (!f.address.trim())      e.address      = 'Business address is required';
  // ── NEW ──
  if (!f.shopName.trim())     e.shopName     = 'Shop name is required';
  if (!f.shopLocation?.coordinates?.length) {
  e.shopLocation = 'Please select your shop location on map';
}
  return e;
}

function validateStep3(f: FormState): FieldErrors {
  const e: FieldErrors = {};
  if (!f.password) e.password = 'Password is required';
  else if (f.password.length < 8) e.password = 'Minimum 8 characters';
  if (f.confirmPassword !== f.password) e.confirmPassword = 'Passwords do not match';
  return e;
}
function LocationPicker({
  value,
  onChange,
}: {
  value: {
    type: 'Point';
    coordinates: [number, number];
  } | null;
  onChange: (
    val: {
      type: 'Point';
      coordinates: [number, number];
    },
    address?: string
  ) => void;
}) {
  function LocationMarker() {
    useMapEvents({
      click(e) {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;

        onChange({
          type: 'Point',
          coordinates: [lng, lat],
        });
      },
    });

    if (!value) return null;

    return (
      <Marker
        position={[
          value.coordinates[1],
          value.coordinates[0],
        ]}
      >
        <Popup>Selected Shop Location</Popup>
      </Marker>
    );
  }

  // Do not render map until location exists
  if (!value) {
    return (
      <div
        style={{
          height: 280,
          borderRadius: 16,
          border: '1px solid var(--border-default)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-subtle)',
          fontSize: 14,
        }}
      >
        Fetching current location...
      </div>
    );
  }

  return (
    <MapContainer
      center={[
        value.coordinates[1],
        value.coordinates[0],
      ]}
      zoom={15}
      style={{
        height: 280,
        width: '100%',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid var(--border-default)',
      }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <SearchControl onSelect={onChange} />

      <LocationMarker />
    </MapContainer>
  );
}
function SearchControl({
  onSelect,
}: {
  onSelect: (
    val: {
      type: 'Point';
      coordinates: [number, number];
    },
    address?: string
  ) => void;
}) {
  const map = useMapEvents({});

  useEffect(() => {
    const provider = new OpenStreetMapProvider();

    const searchControl = new (GeoSearchControl as any)({
      provider,
      style: 'bar',
      autoComplete: true,
      autoCompleteDelay: 250,
      showMarker: false,
      retainZoomLevel: false,
    });

    map.addControl(searchControl);

    map.on('geosearch/showlocation', (result: any) => {
      const lat = result.location.y;
      const lng = result.location.x;

      onSelect(
        {
          type: 'Point',
          coordinates: [lng, lat],
        },
        result.location.label
      );
    });

    return () => {
      map.removeControl(searchControl);
    };
  }, [map, onSelect]);

  return null;
}
// ── Page ───────────────────────────────────────────────
export default function ShopOwnerSignupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // 0, 1, 2
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  useEffect(() => {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      setForm((f) => ({
        ...f,
        shopLocation: {
          type: 'Point',
          coordinates: [lng, lat],
        },
      }));
    },
    () => {
      console.log('Location permission denied');
    }
  );
}, []);
  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setErrors(errs => { const n = { ...errs }; delete n[field]; return n; });
    setApiError('');
  };

  function next() {
    const validators = [validateStep1, validateStep2, validateStep3];
    const e = validators[step](form);
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    setStep(s => s + 1);
  }

 async function handleSubmit(ev: React.FormEvent) {
  ev.preventDefault();
  const e = validateStep3(form);
  if (!agreed) e.terms = 'You must accept the terms';
  if (Object.keys(e).length) { setErrors(e); return; }

  setLoading(true);
  setApiError('');

  try {
    // Step 1 — Register user
    const data = await authApi.signup({
      firstName: form.firstName.trim(),
      lastName:  form.lastName.trim(),
      username:  form.username.trim(),
      email:     form.email.trim().toLowerCase(),
      phone:     form.phone.trim(),
      address:   form.address.trim(),
      password:  form.password,
      role:      'shopOwner',
    });

    saveAuth(data); // save token so addShop request is authenticated

    // Step 2 — Create shop using the saved token
    await shopApi.addShop({
      name:     form.shopName.trim(),
      address:  form.address.trim(),   // reuse user address or use a separate shopAddress field
      location: form.shopLocation,
    });

    navigate(getDashboardPath(data.user.role), { replace: true });

  } catch (err: unknown) {
    setApiError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    // If signup succeeded but addShop failed, user is still saved — don't block login
  } finally {
    setLoading(false);
  }
}

  return (
    <AuthLayout panel={<ShopOwnerPanel />}>
      <div className="auth-form-box">
        {/* Header */}
        <div className="auth-form-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span className="badge badge-cyan" style={{ fontSize: 11 }}>🏪 Shop Owner</span>
          </div>
          <h1 className="auth-form-title">Open your shop</h1>
          <p className="auth-form-subtitle">Complete all three steps to activate your seller account.</p>
        </div>

        <StepBar current={step} total={3} labels={['Profile', 'Contact', 'Security']} />

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

            {/* ── Step 0: Profile ── */}
            {step === 0 && (
              <>
                <div className="alert alert-info" style={{ marginBottom: 4 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                  <span>This information will appear on your public seller profile.</span>
                </div>

                <div className="auth-form-row">
                  <FormInput id="firstName" label="First Name" placeholder="Jane"   value={form.firstName} onChange={set('firstName')} error={errors.firstName} required icon={<IconUser />} autoComplete="given-name" />
                  <FormInput id="lastName"  label="Last Name"  placeholder="Doe"    value={form.lastName}  onChange={set('lastName')}  error={errors.lastName}  required icon={<IconUser />} autoComplete="family-name" />
                </div>

                <FormInput id="username" label="Shop Username" placeholder="janes_boutique" value={form.username} onChange={set('username')} error={errors.username} required icon={<IconStore />} autoComplete="username" hint="This becomes your public shop handle" />

                <FormInput id="email" label="Business Email" type="email" placeholder="shop@example.com" value={form.email} onChange={set('email')} error={errors.email} required icon={<IconMail />} autoComplete="email" />

                <button type="button" onClick={next} className="btn btn-primary btn-lg btn-block" style={{ marginTop: 8 }}>
                  Continue <IconArrow />
                </button>
              </>
            )}

            {/* ── Step 1: Contact ── */}
            {step === 1 && (
              <>
                <div className="alert alert-info" style={{ marginBottom: 4 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                  <span>Customers and support may contact you using these details.</span>
                </div>

                <FormInput id="phone" label="Business Phone" type="tel" placeholder="+91 98765 43210" value={form.phone} onChange={set('phone')} error={errors.phone} required icon={<IconPhone />} autoComplete="tel" />

                <FormInput id="address" label="Business Address" placeholder="Shop / warehouse address" value={form.address} onChange={set('address')} error={errors.address} required icon={<IconMap />} autoComplete="street-address" hint="Used for shipping origin & tax purposes" />
                  <FormInput
                    id="shopName"
                    label="Shop Name"
                    placeholder="Jane's Boutique"
                    value={form.shopName}
                    onChange={set('shopName')}
                    error={errors.shopName}
                    required
                    icon={<IconStore />}
                    hint="This is your public-facing store name"
                    />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
  <label className="input-label">
    Shop Location *
  </label>

  <LocationPicker
    value={form.shopLocation}
    onChange={(location) => {
      setForm((f) => ({
        ...f,
        shopLocation: location,
      }));

      setErrors((errs) => {
        const n = { ...errs };
        delete n.shopLocation;
        return n;
      });
    }}
  />

  {form.shopLocation && (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 12,
        background: 'var(--bg-subtle)',
        fontSize: 13,
      }}
    >
      <strong>Longitude:</strong>{' '}
      {form.shopLocation.coordinates[0]}
      <br />
      <strong>Latitude:</strong>{' '}
      {form.shopLocation.coordinates[1]}
    </div>
  )}

  {errors.shopLocation && (
    <span className="input-hint error">
      {errors.shopLocation}
    </span>
  )}

  <span className="input-hint">
    Click anywhere on the map to change location
  </span>
</div>
                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                  <button type="button" onClick={() => setStep(0)} className="btn btn-secondary btn-lg" style={{ flex: 1 }}>
                    ← Back
                  </button>
                  <button type="button" onClick={next} className="btn btn-primary btn-lg" style={{ flex: 2 }}>
                    Continue <IconArrow />
                  </button>
                </div>
              </>
            )}

            {/* ── Step 2: Security ── */}
            {step === 2 && (
              <>
                <FormInput id="password"        label="Password"         type="password" placeholder="Min. 8 characters" value={form.password}        onChange={set('password')}        error={errors.password}        required icon={<IconLock />} autoComplete="new-password" />
                <FormInput id="confirmPassword" label="Confirm Password" type="password" placeholder="Repeat password"   value={form.confirmPassword} onChange={set('confirmPassword')} error={errors.confirmPassword} required icon={<IconLock />} autoComplete="new-password" />

                {/* Terms */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label className="checkbox-wrap" style={{ cursor: 'pointer', alignItems: 'flex-start' }}>
                    <input type="checkbox" style={{ marginTop: 2 }} checked={agreed} onChange={e => { setAgreed(e.target.checked); setErrors(errs => { const n = { ...errs }; delete n.terms; return n; }); }} />
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      I agree to the{' '}
                      <Link to="/terms" style={{ color: 'var(--text-link)', fontWeight: 600 }}>Terms of Service</Link>,{' '}
                      <Link to="/seller-agreement" style={{ color: 'var(--text-link)', fontWeight: 600 }}>Seller Agreement</Link>{' '}
                      and{' '}
                      <Link to="/privacy" style={{ color: 'var(--text-link)', fontWeight: 600 }}>Privacy Policy</Link>
                    </span>
                  </label>
                  {errors.terms && <span className="input-hint error">{errors.terms}</span>}
                </div>

                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  <button type="button" onClick={() => setStep(1)} className="btn btn-secondary btn-lg" style={{ flex: 1 }}>
                    ← Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className={`btn btn-primary btn-lg${loading ? ' btn-loading' : ''}`}
                    style={{ flex: 2 }}
                  >
                    {!loading && <><span>Open My Shop</span><IconArrow /></>}
                    {loading && <span>Registering…</span>}
                  </button>
                </div>
              </>
            )}
          </div>
        </form>

        <div className="auth-form-footer" style={{ marginTop: 24 }}>
          <p style={{ margin: 0 }}>
            Already registered?{' '}
            <Link to="/login" style={{ color: 'var(--text-link)', fontWeight: 'var(--weight-semibold)' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}