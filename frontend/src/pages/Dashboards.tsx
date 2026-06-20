import { Link } from 'react-router-dom';
import { getUser, clearAuth } from '../utils/auth';
import { useNavigate } from 'react-router-dom';

function DashboardShell({ title, badge, accent }: { title: string; badge: string; accent: string }) {
  const user = getUser();
  const navigate = useNavigate();

  function handleLogout() {
    clearAuth();
    navigate('/login', { replace: true });
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 40 }}>
      <div className="card card-elevated" style={{ maxWidth: 480, width: '100%', textAlign: 'center', padding: 48 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{accent}</div>
        <span className="badge badge-cyan" style={{ marginBottom: 16 }}>{badge}</span>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', margin: '12px 0 8px', color: 'var(--text-primary)' }}>{title}</h1>
        {user && (
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 32px' }}>
            Welcome back, <strong style={{ color: 'var(--text-primary)' }}>{user.firstName} {user.lastName}</strong>!<br />
            <span style={{ fontSize: 'var(--text-sm)' }}>Signed in as <code style={{ background: 'var(--bg-subtle)', padding: '2px 6px', borderRadius: 4 }}>{user.email}</code></span>
          </p>
        )}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={handleLogout} className="btn btn-secondary">Sign Out</button>
          <button onClick={handleLogout} className="btn btn-ghost btn-sm">← Back to Login</button>
        </div>
      </div>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
        This is a placeholder. Build your real dashboard here.
      </p>
    </div>
  );
}

// export function UserDashboard() {
//   return <DashboardShell title="Your Dashboard" badge="👤 User" accent="🛒" />;
// }

// export function ShopDashboard() {
//   return <DashboardShell title="Shop Dashboard" badge="🏪 Shop Owner" accent="📊" />;
// }

export function AdminDashboard() {
  return <DashboardShell title="Admin Dashboard" badge="🔑 Admin" accent="⚙️" />;
}

export function Unauthorized() {
  const navigate = useNavigate();

  function handleLogout() {
    clearAuth();
    navigate('/login', { replace: true });
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div className="card card-elevated" style={{ maxWidth: 400, width: '100%', textAlign: 'center', padding: 48 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', margin: '0 0 12px' }}>Access Denied</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>You don't have permission to view this page.</p>
        <Link to="/login" className="btn btn-primary" onClick={handleLogout}>Back to Login</Link>
      </div>
    </div>
  );
}