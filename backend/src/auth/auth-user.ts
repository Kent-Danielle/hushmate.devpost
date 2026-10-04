/** What AuthGuard puts on `request.user`. */
export interface AuthUser {
  id: string;
  isDemo: boolean;
  activeHouseId: string | null;
}
