import type { DeletedEntityResponse, ItemListResponse, UUID, Version } from "./common.js";

export interface CostCenterDTO {
  id: UUID;
  bookId: UUID;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  version: Version;
}

export type CostCenterListResponse = ItemListResponse<CostCenterDTO>;

export interface ListCostCentersQuery {
  bookId: UUID;
  includeInactive?: boolean;
}

export interface CreateCostCenterRequest {
  bookId: UUID;
  name: string;
  description?: string | null;
  sortOrder?: number;
}

export interface UpdateCostCenterRequest {
  name?: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  version: Version;
}

export type CreateCostCenterResponse = CostCenterDTO;
export type UpdateCostCenterResponse = CostCenterDTO;

export interface DeactivatedCostCenterResponse {
  id: UUID;
  isActive: false;
  version: Version;
}

export type DeleteCostCenterResponse = DeletedEntityResponse | DeactivatedCostCenterResponse;
