export type Role = "owner" | "supervisor";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  last_login_at?: string;
  created_at: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface LoginResponse {
  user: User;
  tokens: TokenPair;
}
