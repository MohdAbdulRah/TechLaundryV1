import type { AuthToken, User, UserRole } from '../types/auth';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

export function saveAuth(data: AuthToken): void {
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

/** Returns the dashboard path for a given role */
export function getDashboardPath(role: UserRole): string {
  switch (role) {
    case 'shopOwner':
      return '/shop-dashboard';

    case 'admin':
      return '/admin-dashboard';

    case 'deliveryBoy':
      return '/delivery-dashboard';

    case 'user':
    default:
      return '/dashboard';
  }
}

/** Decode a JWT payload without verifying signature (client-side only) */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(payload);
  } catch {
    return null;
  }
}