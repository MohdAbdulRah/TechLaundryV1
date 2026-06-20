import { useState, useEffect, useContext, createContext, useRef } from 'react';
import { NavLink, useNavigate, useLocation, Outlet } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faStore,
  faUser,
  faChartLine,
  faMoneyBillWave,
  faUsers,
  faGear,
  faWrench,
  faRightFromBracket,
  faMap,
  faBars,
  faChevronLeft,
  faChevronRight,
  faTimes,
  faCommentDollar,
  faRobot,
  faCartShopping,
  faTableCellsLarge,
  faTruck,
  faBagShopping,
  faHexagonNodes,
  faCheckCircle

} from '@fortawesome/free-solid-svg-icons';
import { getUser, clearAuth } from '../utils/auth';
import type { UserRole } from '../types/auth';
import { useCart } from "../context/CartContext";
// ─── Page title context ───────────────────────────────────────────────────────

interface TitleCtx { title: string; setTitle: (t: string) => void }
const PageTitleContext = createContext<TitleCtx>({ title: '', setTitle: () => {} });

export function usePageTitle(title: string) {
  const { setTitle } = useContext(PageTitleContext);
  const ref = useRef(title);
  ref.current = title;
  useEffect(() => {
    setTitle(ref.current);
    return () => setTitle('');
  }, [setTitle]);
}

// ─── Nav config ───────────────────────────────────────────────────────────────

interface NavItem    { icon: any; label: string; to: string; end?: boolean }
interface NavSection { heading?: string; groupIcon?: any; items: NavItem[] }

const NAV: Record<UserRole, NavSection[]> = {
  user: [
    {
      heading: 'Explore',
      groupIcon: faMap,
      items: [
        { icon: faStore, label: 'Shops', to: '/dashboard', end: true },
        { icon: faCommentDollar, label: 'Services', to: '/user/prices', end: true },
        { icon: faRobot, label: 'Predict Prices', to: '/predict/prices', end: true },
        { icon: faHexagonNodes, label: 'Chat With AI', to: '/chat-user', end: true },
      ],
    },
    {
      heading: 'Account',
      groupIcon: faUser,
      items: [
        { icon: faUser, label: 'Profile', to: '/dashboard/userProfile' },
         { icon: faBagShopping, label: 'My Orders', to: '/orders' }
      
      ],
    },
  ],
  shopOwner: [
    {
      heading: 'Shop',
      groupIcon: faStore,
      items: [
        { icon: faChartLine, label: 'Overview', to: '/shop-dashboard', end: true },
        { icon: faStore, label: 'My Shop',  to: '/shop-dashboard/shop' },
        { icon: faMoneyBillWave, label: 'Prices',   to: '/shop-dashboard/prices' },
      ],
    },
    {
      heading: 'Account',
      groupIcon: faUser,
      items: [
        { icon: faUser, label: 'Profile', to: '/shop/owner/Profile' },
        { icon: faTruck, label: 'Orders', to: '/shop/orders' },
      ],
    },
  ],
  admin: [
    {
      heading: 'Management',
      groupIcon: faGear,
      items: [
        { icon: faGear, label: 'Overview',  to: '/admin-dashboard', end: true },
        { icon: faUsers, label: 'Users',     to: '/admin-dashboard/users' },
        { icon: faStore, label: 'All Shops', to: '/admin-dashboard/shops' },
         { icon: faTableCellsLarge, label: 'All Categories', to: '/categories' },
      ],
    },
    {
      heading: 'System',
      groupIcon: faWrench,
      items: [{ icon: faWrench, label: 'Settings', to: '/admin-dashboard/settings' }],
    },
  ],
   deliveryBoy: [
    {
      heading: 'Delivery',
      groupIcon: faTruck,
      items: [
        {
          icon: faTruck,
          label: 'Orders',
          to: '/delivery-dashboard',
          end: true
        },
         {
          icon: faCheckCircle,
          label: 'Done Deliveries',
          to: '/delivery-dashboard/done-delieveries',
          end: true
        },
      ],
    },
    {
      heading: 'Account',
      groupIcon: faUser,
      items: [
        {
          icon: faUser,
          label: 'Profile',
          to: '/delivery-dashboard/profile'
        },
      ],
    },
  ],
};

const ROLE_META: Record<UserRole, { label: string; color: string; bg: string }> = {
  user:      { label: 'User',       color: 'var(--cyan-400)',   bg: 'rgba(0,180,216,0.15)'  },
  shopOwner: { label: 'Shop Owner', color: '#fbbf24',           bg: 'rgba(251,191,36,0.15)' },
  admin:     { label: 'Admin',      color: '#f87171',           bg: 'rgba(248,113,113,0.15)'},
  deliveryBoy: {
    label: 'Delivery Boy',
    color: '#4ade80',
    bg: 'rgba(74,222,128,0.15)'
  },
};

function initials(first = '', last = '') {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase() || '??';
}
function getUserName(user: ReturnType<typeof getUser>) {
  if (!user) return 'User';
  const full = `${(user as any).firstName ?? ''} ${(user as any).lastName ?? ''}`.trim();
  return full || (user as any).username || 'User';
}

/** Returns true if the current pathname matches any item in the section. */
function useSectionActive(items: NavItem[]): boolean {
  const { pathname } = useLocation();
  return items.some(item =>
    item.end ? pathname === item.to : pathname.startsWith(item.to)
  );
}

// ─── Collapsed group button ───────────────────────────────────────────────────
// Separate component so it can call useSectionActive (hook rules).

function CollapsedGroup({
  sec,
  si,
  onClose,
}: {
  sec: NavSection;
  si: number;
  onClose: () => void;
}) {
  const isActive = useSectionActive(sec.items);
  const navigate  = useNavigate();

  // Navigate to the first item in the group when the icon is clicked
  function handleClick() {
    if (sec.items[0]) {
      navigate(sec.items[0].to);
      onClose();
    }
  }

  return (
    <div
      style={{
        borderTop: si > 0 ? '1px solid rgba(255,255,255,0.07)' : undefined,
        marginTop: si > 0 ? 6 : 0,
        paddingTop: si > 0 ? 8 : 2,
        paddingBottom: 4,
      }}
    >
      <button
        onClick={handleClick}
        title={sec.heading}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          padding: '8px 0',
          borderRadius: 8,
          border: 'none',
          cursor: 'pointer',
          fontSize: 18,
          lineHeight: 1,
          userSelect: 'none',
          position: 'relative',
          // Active: same treatment as sidebar-item.active
          background: isActive ? 'var(--bg-sidebar-active)' : 'transparent',
          color:      isActive ? 'var(--sidebar-text-active)' : 'rgba(255,255,255,1)',
          opacity:    isActive ? 1 : 0.45,
          transition: 'background 0.15s, opacity 0.15s',
        }}
      >
        {/* Active left-bar indicator */}
        {isActive && (
          <span
            style={{
              position: 'absolute',
              left: 0, top: '50%',
              transform: 'translateY(-50%)',
              width: 3, height: '60%',
              background: 'var(--cyan-500)',
              borderRadius: '0 3px 3px 0',
            }}
          />
        )}
        <FontAwesomeIcon icon={sec.groupIcon} />
      </button>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarProps {
  role: UserRole;
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}

function Sidebar({ role, open, collapsed, onClose, onToggleCollapse }: SidebarProps) {
  const user     = getUser();
  const navigate = useNavigate();
  const sections = NAV[role] ?? NAV.user;
  const meta     = ROLE_META[role];

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(2,9,20,0.65)',
            zIndex: 'calc(var(--z-sticky) - 1)' as any,
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      <aside className={`app-sidebar${open ? ' sidebar-open' : ''}${collapsed ? ' sidebar-collapsed' : ''}`}>

        {/* ── Logo row ── */}
        <div className="sidebar-logo-row">
          {!collapsed && (
            <>
              <div
                className="sidebar-logo-icon"
                style={{ width: 32, height: 32, borderRadius: 9, fontSize: 16, flexShrink: 0 }}
              >
                M
              </div>
              <span className="sidebar-logo-name">MANRO</span>
            </>
          )}
          <button
            onClick={onToggleCollapse}
            className="sidebar-collapse-btn"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            <FontAwesomeIcon icon={collapsed ? faChevronRight : faChevronLeft} />
          </button>
          <button onClick={onClose} className="sidebar-close-btn" aria-label="Close">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        {/* ── Role pill / dot ── */}
        {!collapsed ? (
          <div style={{ padding: '6px 8px 14px' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 'var(--radius-full)',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
              textTransform: 'uppercase' as const,
              background: meta.bg, color: meta.color,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
              {meta.label}
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 10px' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color, display: 'block' }} />
          </div>
        )}

        {/* ── Nav ── */}
        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 4px' }}>
          {sections.map((sec, si) => (
            <div key={si} style={{ marginBottom: 4 }}>

              {/* COLLAPSED MODE: one button per group, highlighted if any child is active */}
              {collapsed && (
                <CollapsedGroup sec={sec} si={si} onClose={onClose} />
              )}

              {/* EXPANDED MODE: group icon + heading label, then each page item */}
              {!collapsed && (
                <>
                  {/* Group heading row */}
                  {sec.heading && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '14px 8px 5px' }}>
                      {sec.groupIcon && (
                        <span style={{ fontSize: 12, lineHeight: 1, opacity: 0.5, flexShrink: 0 }}>
                          <FontAwesomeIcon icon={sec.groupIcon} />
                        </span>
                      )}
                      <span className="sidebar-section-label" style={{ padding: 0, margin: 0 }}>
                        {sec.heading}
                      </span>
                    </div>
                  )}

                  {/* Page nav items — each highlights individually */}
                  {sec.items.map(item => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
                      onClick={onClose}
                      style={{ userSelect: 'none' }}
                    >
                      <FontAwesomeIcon icon={item.icon} style={{ fontSize: 16, flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{item.label}</span>
                    </NavLink>
                  ))}
                </>
              )}
            </div>
          ))}
        </nav>

        {/* ── Footer ── */}
        <div className="sidebar-footer">
          <div className="sidebar-divider" style={{ margin: '0 0 8px' }} />

          {!collapsed ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px',
              borderRadius: 10, background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              marginBottom: 6,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(0,180,216,0.2)', border: '2px solid rgba(0,180,216,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: 'var(--cyan-300)', flexShrink: 0,
              }}>
                {user ? initials((user as any).firstName, (user as any).lastName) : '??'}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3,
                }}>
                  {getUserName(user)}
                </div>
                <div style={{
                  fontSize: 11, color: 'rgba(255,255,255,0.35)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.4,
                }}>
                  {user?.email ?? ''}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 6 }}>
              <div
                title={user?.email ?? getUserName(user)}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'rgba(0,180,216,0.2)', border: '2px solid rgba(0,180,216,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: 'var(--cyan-300)',
                }}
              >
                {user ? initials((user as any).firstName, (user as any).lastName) : '??'}
              </div>
            </div>
          )}

          <button
            onClick={() => { clearAuth(); navigate('/login', { replace: true }); }}
            className={`sidebar-item${collapsed ? ' sidebar-item-collapsed' : ''}`}
            style={{
              width: '100%', background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(248,113,113,0.75)', fontFamily: 'var(--font-sans)',
            }}
            title={collapsed ? 'Sign Out' : undefined}
          >
            <FontAwesomeIcon icon={faRightFromBracket} style={{ fontSize: 16 }} />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>

      </aside>
    </>
  );
}

// ─── DashboardLayout ──────────────────────────────────────────────────────────

interface DashboardLayoutProps {
  role: UserRole;
  children?: React.ReactNode;
}

const COLLAPSED_WIDTH = 64;
const EXPANDED_WIDTH  = 240;

export function DashboardLayout({ role, children }: DashboardLayoutProps) {
  const [sidebarOpen,      setSidebarOpen]      = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [pageTitle,        setPageTitle]        = useState('');
  const navigate = useNavigate();
  const { totalItems } = useCart();
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 900) setSidebarOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const sidebarWidth = sidebarCollapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  return (
    <PageTitleContext.Provider value={{ title: pageTitle, setTitle: setPageTitle }}>
      <style>{`
        .app-sidebar {
          width: ${EXPANDED_WIDTH}px;
          height: 100vh;
          background: var(--bg-sidebar);
          display: flex;
          flex-direction: column;
          padding: 20px 12px 0;
          border-right: 1px solid var(--sidebar-border);
          position: fixed;
          left: 0; top: 0;
          z-index: var(--z-sticky);
          overflow: hidden;
          box-sizing: border-box;
          transition: width 0.26s cubic-bezier(0.4,0,0.2,1),
                      transform 0.28s cubic-bezier(0.4,0,0.2,1);
        }
        .app-sidebar.sidebar-collapsed {
          width: ${COLLAPSED_WIDTH}px;
          padding-left: 6px;
          padding-right: 6px;
        }
        .sidebar-footer {
          flex-shrink: 0;
          padding: 8px 4px 16px;
        }
        .sidebar-logo-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 4px 16px;
          border-bottom: 1px solid var(--sidebar-border);
          margin-bottom: 8px;
          flex-shrink: 0;
          min-width: 0;
        }
        .app-sidebar.sidebar-collapsed .sidebar-logo-row {
          justify-content: center;
          gap: 0;
          padding-left: 0;
          padding-right: 0;
        }
        .sidebar-collapse-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-left: auto;
          background: none;
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px;
          width: 24px; height: 24px;
          cursor: pointer;
          color: rgba(255,255,255,0.4);
          font-size: 14px;
          line-height: 1;
          flex-shrink: 0;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .sidebar-collapse-btn:hover {
          background: rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.85);
          border-color: rgba(255,255,255,0.25);
        }
        .app-sidebar.sidebar-collapsed .sidebar-collapse-btn {
          margin-left: 0;
          width: 30px; height: 30px;
          font-size: 16px;
        }
        .sidebar-close-btn {
          display: none;
          background: none;
          border: none;
          color: rgba(255,255,255,0.35);
          font-size: 18px;
          cursor: pointer;
          padding: 2px 4px;
          line-height: 1;
        }
        .sidebar-section-label {
          padding: 0 !important;
          margin: 0 !important;
        }
        .sidebar-item-collapsed {
          justify-content: center !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
        }
        .sidebar-item.active {
          background: var(--bg-sidebar-active);
          color: var(--sidebar-text-active);
          position: relative;
        }
        .sidebar-item.active::before {
          content: '';
          position: absolute;
          left: 0; top: 50%;
          transform: translateY(-50%);
          width: 3px; height: 60%;
          background: var(--cyan-500);
          border-radius: 0 3px 3px 0;
        }
        .app-sidebar nav::-webkit-scrollbar { width: 3px; }
        .app-sidebar nav::-webkit-scrollbar-track { background: transparent; }
        .app-sidebar nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        .dashboard-main {
          margin-left: ${sidebarWidth}px;
          min-height: 100vh;
          background: var(--bg-page);
          display: flex;
          flex-direction: column;
          transition: margin-left 0.26s cubic-bezier(0.4,0,0.2,1);
        }
        .dashboard-topbar {
          height: 56px;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          padding: 0 24px;
          gap: 12px;
          position: sticky;
          top: 0;
          z-index: calc(var(--z-sticky) - 1);
          box-shadow: var(--shadow-xs);
          flex-shrink: 0;
        }
        .menu-toggle {
          display: none;
          background: none;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          width: 36px; height: 36px;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 18px;
          color: var(--text-secondary);
          transition: all var(--ease-fast);
          flex-shrink: 0;
        }
        .menu-toggle:hover { background: var(--bg-subtle); color: var(--text-primary); }
        .dashboard-content { flex: 1; padding: 28px; background:var(--navy-100);}
        @media (max-width: 899px) {
          .app-sidebar {
            width: ${EXPANDED_WIDTH}px !important;
            transform: translateX(-100%);
            box-shadow: none;
          }
          .app-sidebar.sidebar-open { transform: translateX(0); box-shadow: var(--shadow-xl); }
          .sidebar-close-btn { display: flex !important; }
          .sidebar-collapse-btn { display: none !important; }
          .dashboard-main { margin-left: 0 !important; }
          .menu-toggle { display: flex; }
          .dashboard-content { padding: 20px 16px; }
          .dashboard-topbar { padding: 0 16px; }
        }
        @keyframes pageEnter {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .page-enter { animation: pageEnter 0.28s ease both; }
      `}</style>

      <Sidebar
        role={role}
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed(c => !c)}
      />

      <div className="dashboard-main" style={{ marginLeft: sidebarWidth }}>
        <header className="dashboard-topbar">
          <button className="menu-toggle" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
            <FontAwesomeIcon icon={faBars} />
          </button>

          {pageTitle && (
            <h1 style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-lg)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
            }}>
              {pageTitle}
            </h1>
          )}

          <div style={{ flex: 1 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {/* ── View Cart ── */}
          {role === 'user' && (
              <button
                onClick={() => navigate('/cart')}
                className="btn btn-secondary btn-sm"
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  position: 'relative'
                }}
              >
                <FontAwesomeIcon icon={faCartShopping} />

                View Cart

                {totalItems > 0 && (
                  <span
                    style={{
                      minWidth: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: 'var(--cyan-500)',
                      color: '#000',
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 5px'
                    }}
                  >
                    {totalItems}
                  </span>
                )}
              </button>
            )}
            <button
              onClick={() => { clearAuth(); navigate('/login', { replace: true }); }}
              className="btn btn-secondary btn-sm"
              style={{ flexShrink: 0 }}
            >
              Sign Out
            </button>
          </div>
        </header>

        <div className="dashboard-content page-enter">
          {children ?? <Outlet />}
        </div>
      </div>
    </PageTitleContext.Provider>
  );
}