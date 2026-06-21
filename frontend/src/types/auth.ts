export type UserRole = 'user' | 'shopOwner' | 'admin' | 'deliveryBoy';

export interface User {
  id: string;
  username: string;
  email: string;
  
  role: UserRole;
  firstName : string;
  lastName : string;
}

export interface AuthToken {
  token: string;
  user: User;
}

export interface LoginPayload {
  identifier: string; // username or email
  password: string;
}

export interface SignupPayload {
  username: string;
  email: string;
  phone: string;
  password: string;
  firstName: string;
  lastName: string;
  address: string;
  role: UserRole;
}

export interface ApiError {
  message: string;
  field?: string;
}

export interface FieldErrors {
  [key: string]: string;
}