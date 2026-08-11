import type { CurrencyCode, ISODateTimeString, ItemListResponse, UUID, Version } from "./common.js";

export type BookRole = "OWNER" | "ADMIN" | "EDITOR" | "ACCOUNTANT" | "VIEWER";
export type BookType = "PERSONAL" | "BUSINESS" | "OTHER";
export type BookMemberStatus = "INVITED" | "ACTIVE" | "DISABLED";

export interface BookDTO {
  id: UUID;
  name: string;
  bookType: BookType;
  baseCurrency: CurrencyCode;
  version: Version;
}

export interface CreatedBookDTO extends BookDTO {
  createdAt: ISODateTimeString;
}

export interface BookListItemDTO extends BookDTO {
  role: BookRole;
}

export type BookListResponse = ItemListResponse<BookListItemDTO>;

export interface CreateBookRequest {
  name: string;
  bookType: BookType;
  baseCurrency?: CurrencyCode;
}

export type CreateBookResponse = CreatedBookDTO;
export type GetBookResponse = BookDTO;

export interface BookMemberDTO {
  id: UUID;
  userId: UUID;
  email: string;
  displayName: string;
  role: BookRole;
  status: BookMemberStatus;
  version: Version;
}

export type BookMemberListResponse = ItemListResponse<BookMemberDTO>;

export interface AddBookMemberRequest {
  email: string;
  role: Exclude<BookRole, "OWNER">;
}

/** The create-member endpoint does not join user profile fields into its response. */
export interface AddBookMemberResponse {
  id: UUID;
  bookId: UUID;
  userId: UUID;
  role: Exclude<BookRole, "OWNER">;
  status: BookMemberStatus;
  version: Version;
}
