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

export interface CreateHouseBody {
  name: string;
}

export interface CreateHouseResponse {
  house: House;
}

/** GET /invites/:token (public). */
export interface InviteInfo {
  name: string;
  code: string;
}

export interface JoinResponse {
  membershipId: string;
  status: 'pending';
}

/** GET /houses/:id/requests (owner). */
export interface JoinRequest {
  membershipId: string;
  name: string;
  createdAt: string;
}

export interface ActivateResponse {
  activeHouseId: string;
}

export interface InviteLinkResponse {
  url: string;
}

export interface VapidKeyResponse {
  key: string;
}

export interface PushSubscriptionBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** GET /houses/:id/board. Quiet times are used from slice 5; the nudge sheet needs only members. */
export interface BoardMember {
  id: string;
  name: string;
  colorIndex: number | null;
  isAway: boolean;
  isYou: boolean;
}

export interface BoardQuietTime {
  id: string;
  userId: string;
  setId: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

export interface Board {
  members: BoardMember[];
  quietTimes: BoardQuietTime[];
}

/** POST /nudges {recipientId} -> 201, and the body of a 429. */
export interface NudgeSent {
  cooldownUntil: string;
}

/** GET /nudges/pending. The sender is never included. */
export interface PendingNudge {
  id: string;
  message: string;
  subtitle: string | null;
  isDemo: boolean;
  createdAt: string;
}

export interface AcknowledgeResponse {
  acknowledged: number;
}

export interface SummaryHeadsUp {
  id: string;
  text: string;
  at: string;
  authorName: string;
}

export interface SummaryAck {
  nudgeId: string;
  recipientName: string;
  acknowledgedAt: string;
}

/** GET /houses/:id/summary. */
export interface Summary {
  streakDays: number;
  isDemo: boolean;
  headsUps: SummaryHeadsUp[];
  myAcks: SummaryAck[];
}
