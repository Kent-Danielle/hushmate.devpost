// Mirrors spec.md > The backend API contract. Shapes only; the backend is the source of truth.

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
}

export interface House {
  id: string;
  name: string;
  code: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  isDemo: boolean;
  activeHouseId: string | null;
  nudgeCooldownUntil: string | null;
  demo?: { houseName: string; botNames: string[] };
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface SignUpBody {
  name: string;
  email: string;
  password: string;
}

export interface SignInBody {
  email: string;
  password: string;
}

export interface HouseListItem {
  membershipId: string;
  status: 'pending' | 'approved' | 'declined';
  house: House;
  isActive: boolean;
  isOwner: boolean;
  pendingCount: number;
  setupDone: boolean;
}

export interface VapidKeyResponse {
  key: string;
}

export interface PushSubscriptionBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}
