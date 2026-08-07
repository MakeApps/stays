/** Shapes returned by the Flask API. Kept hand-written until Phase 4 adds an
 *  OpenAPI snapshot to generate from. */

export type Role = "admin" | "staff" | "cleaner" | "accountant";

export type Capability =
  | "condo:read" | "condo:write" | "condo:delete"
  | "booking:read" | "booking:write" | "booking:delete"
  | "expense:read" | "expense:write" | "expense:delete"
  | "income:read" | "income:export"
  | "calendar:read" | "calendar:write"
  | "dashboard:read" | "activity:read"
  | "user:read" | "user:write";

export interface SessionUser {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  capabilities: Capability[];
  last_login_at: string | null;
}

export type UnitStatus = "available" | "occupied" | "reserved" | "maintenance";
export type PropertyType = "Condominium" | "Serviced apartment" | "Townhouse";

export interface CondoImage {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
  position: number;
}

export interface Condo {
  id: string;
  code: string;
  name: string;
  property_type: PropertyType;
  bedrooms: number;
  bathrooms: number;
  size_sqm: number | null;
  /** Decimal strings in baht. The API stores satang; never parse these with
   *  parseFloat for arithmetic that gets persisted. */
  night_rate: string;
  month_rate: string;
  cleaning_fee: string;
  security_deposit: string;
  address: string | null;
  description: string | null;
  status: UnitStatus;
  images: CondoImage[];
  cover_url: string | null;
  /** Pre-rendered by the API so ฿ formatting cannot drift between the two apps. */
  night_rate_label: string;
  month_rate_label: string;
}

export interface PageMeta {
  page: number;
  per_page: number;
  total: number;
  pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface StatusFacets {
  all: number;
  available: number;
  occupied: number;
  reserved: number;
  maintenance: number;
}

export interface CondoListResponse {
  items: Condo[];
  meta: PageMeta;
  facets: { status: StatusFacets };
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { fields?: Record<string, string[]>; [k: string]: unknown };
    request_id?: string;
  };
}
