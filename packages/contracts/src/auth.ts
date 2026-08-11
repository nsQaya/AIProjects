import type { ISODateTimeString, UUID, Version } from "./common.js";
import type { CreatedBookDTO } from "./books.js";

export type UserStatus = "PENDING" | "ACTIVE" | "SUSPENDED";

export interface UserDTO {
  id: UUID;
  email: string;
  displayName: string;
}

export interface CurrentUserDTO extends UserDTO {
  status: UserStatus;
  createdAt: ISODateTimeString;
  version: Version;
}

export interface AuthTokensDTO {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export type LogoutRequest = RefreshTokenRequest;

export interface RegisterResponse extends AuthTokensDTO {
  user: UserDTO;
  book: CreatedBookDTO;
}

export interface LoginResponse extends AuthTokensDTO {
  user: UserDTO;
}

export type RefreshTokenResponse = AuthTokensDTO;
export type LogoutResponse = void;
export type CurrentUserResponse = CurrentUserDTO;
