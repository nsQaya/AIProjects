import type { CurrencyCode, DeletedEntityResponse, ItemListResponse, UUID, Version } from "./common.js";

export type CategoryType = "INCOME" | "EXPENSE";

export interface CategoryDTO {
  id: UUID;
  bookId: UUID;
  parentId: UUID | null;
  name: string;
  categoryType: CategoryType;
  icon: string | null;
  sortOrder: number;
  isSystem: boolean;
  isActive: boolean;
  version: Version;
}

export type CategoryListResponse = ItemListResponse<CategoryDTO>;

export interface ListCategoriesQuery {
  bookId: UUID;
  includeInactive?: boolean;
}

export interface CreateCategoryRequest {
  bookId: UUID;
  parentId?: UUID | null;
  name: string;
  categoryType: CategoryType;
  currencyCode: CurrencyCode;
  icon?: string | null;
  sortOrder?: number;
}

export interface UpdateCategoryRequest {
  parentId?: UUID | null;
  name?: string;
  icon?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  version: Version;
}

export type CreateCategoryResponse = CategoryDTO;
export type UpdateCategoryResponse = CategoryDTO;

export interface DeactivatedCategoryResponse {
  id: UUID;
  isActive: false;
  version: Version;
}

export type DeleteCategoryResponse = DeletedEntityResponse | DeactivatedCategoryResponse;
