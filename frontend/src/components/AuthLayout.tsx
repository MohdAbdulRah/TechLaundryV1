import React from 'react';
import './css/AuthLayout.css';

interface AuthLayoutProps {
  children: React.ReactNode;
  /** Content rendered in the left panel */
  panel: React.ReactNode;
}

export function AuthLayout({ children, panel }: AuthLayoutProps) {
  return (
    <div className="auth-shell">
      {/* Left decorative panel */}
      <aside className="auth-panel">
        <div className="auth-panel-inner">
          {panel}
        </div>
        {/* Animated background elements */}
        <div className="auth-panel-orb auth-panel-orb-1" />
        <div className="auth-panel-orb auth-panel-orb-2" />
        <div className="auth-panel-grid" />
      </aside>

      {/* Right form area */}
      <main className="auth-form-area">
        {children}
      </main>
    </div>
  );
}