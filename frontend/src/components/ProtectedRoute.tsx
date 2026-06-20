import { Navigate } from 'react-router-dom';
import { isAuthenticated, getUser } from '../utils/auth';
import type { UserRole } from '../types/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** If provided, restrict to these roles only */
  roles?: UserRole[];
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (roles) {
    const user = getUser();
    if (!user || !roles.includes(user.role)) {
      // User is logged in but doesn't have the right role
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
}

/** Redirect already-authenticated users away from auth pages */
export function GuestRoute({ children }: { children: React.ReactNode }) {
  if (isAuthenticated()) {
    const user = getUser();
    const dest = user?.role === 'shopOwner' ? '/shop-dashboard'
               : user?.role === 'admin'     ? '/admin-dashboard'
               : '/dashboard';
    return <Navigate to={dest} replace />;
  }
  return <>{children}</>;
}