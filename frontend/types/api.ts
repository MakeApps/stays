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

// ---------------------------------------------------------------- bookings

export type BookingStatus = "booked" | "pending" | "maintenance" | "cancelled";
export type PaymentStatus = "paid" | "partial" | "pending" | "blocked";
export type PricingMode = "nightly" | "total";

export interface Booking {
  id: string;
  condo_id: string;
  condo_name: string;
  condo_code: string;

  guest_name: string;
  guest_phone: string | null;
  guest_email: string | null;

  /** `YYYY-MM-DD`. Half-open: the guest occupies check_in but not check_out. */
  check_in: string;
  check_out: string;
  nights: number;

  status: BookingStatus;
  payment_status: PaymentStatus;
  pricing_mode: PricingMode;

  /** Decimal strings in baht. The API stores satang. */
  night_rate: string;
  subtotal: string;
  discount: string;
  cleaning_fee: string;
  other_charges: string;
  tax_pct: string;
  tax: string;
  total: string;
  received: string;
  balance: string;

  notes: string | null;

  total_label: string;
  balance_label: string;
  night_rate_label: string;
}

export interface BookingListResponse {
  items: Booking[];
  meta: PageMeta;
}

export interface QuoteResponse {
  nights: number;
  night_rate: string;
  subtotal: string;
  discount: string;
  cleaning_fee: string;
  other_charges: string;
  tax_pct: string;
  tax: string;
  total: string;
  received: string;
  balance: string;
  payment_status: PaymentStatus;
  total_label: string;
  balance_label: string;
  night_rate_label: string;
}

export interface BookingConflict {
  booking_id: string;
  guest_name: string;
  check_in: string;
  check_out: string;
}

export interface AvailabilityResponse {
  available: boolean;
  conflict: BookingConflict | null;
}

export interface CalendarResource {
  id: string;
  code: string;
  name: string;
}

export interface CalendarEvent {
  id: string;
  condo_id: string;
  guest_name: string;
  check_in: string;
  check_out: string;
  nights: number;
  status: BookingStatus;
  payment_status: PaymentStatus;
}

export interface CalendarResponse {
  range: { start: string; end: string };
  resources: CalendarResource[];
  events: CalendarEvent[];
}

// ---------------------------------------------------------------- expenses

export type ExpenseStatus = "paid" | "pending" | "cancelled";

export interface Expense {
  id: string;
  condo_id: string;
  condo_name: string;
  condo_code: string;
  category_id: string;
  category: string;
  /** DS pill modifier from the design's CATTONE map. */
  category_tone: string;
  method_id: string;
  method: string;
  spent_on: string;
  amount: string;
  amount_label: string;
  vendor: string | null;
  reference: string | null;
  description: string;
  status: ExpenseStatus;
  notes: string | null;
  receipt_url: string | null;
  receipt_filename: string | null;
  receipt_content_type: string | null;
  created_at: string;
}

export interface ExpenseListResponse {
  items: Expense[];
  meta: PageMeta;
}

export interface Lookups {
  categories: { id: string; name: string; tone: string }[];
  methods: { id: string; name: string }[];
}

export interface CategorySlice {
  category: string;
  tone: string;
  amount: string;
  label: string;
  pct: number;
}

export interface TrendPoint {
  month: string;
  revenue: string;
  expenses: string;
  net: string;
}

export interface ExpenseSummary {
  period: { start: string; end: string };
  today: { amount: string; label: string };
  month: {
    expenses: string;
    expenses_label: string;
    revenue: string;
    revenue_label: string;
    net: string;
    net_label: string;
    margin_pct: number;
  };
  pending: { amount: string; label: string; count: number };
  by_category: CategorySlice[];
  trend: (TrendPoint & { start: string })[];
}

export interface CondoProfitRow {
  condo_id: string;
  name: string;
  code: string;
  bookings: number;
  nights: number;
  revenue: string;
  revenue_label: string;
  expenses: string;
  expenses_label: string;
  net: string;
  net_label: string;
  occupancy_pct: number;
}

export interface IncomeSummary {
  period: { start: string; end: string };
  kpis: {
    today: string;
    week: string;
    month: string;
    expenses: string;
    net: string;
    margin_pct: number;
    outstanding: string;
    outstanding_count: number;
  };
  by_condo: CondoProfitRow[];
  trend: TrendPoint[];
}

// ---------------------------------------------------------------- dashboard

export interface DashboardKpis {
  total_condos: number;
  occupied: number;
  vacant: number;
  maintenance: number;
  occupancy_pct: number;
  revenue_today: string;
  revenue_month: string;
  expenses_month: string;
  net_month: string;
  check_ins_7d: number;
  check_outs_7d: number;
  outstanding: string;
  outstanding_count: number;
  booked_nights: number;
  avg_per_day: string;
  best_day: string | null;
  best_day_label: string;
}

export interface DayPoint {
  date: string;
  amount: string;
  label: string;
  is_today: boolean;
}

export interface UpcomingBooking {
  id: string;
  guest_name: string;
  condo_name: string;
  condo_code: string;
  check_in: string;
  check_out: string;
  nights: number;
  total_label: string;
  payment_status: PaymentStatus;
}

export interface ActivityEntry {
  id: string;
  title: string;
  body: string;
  when: string;
  kind: string;
  actor: string | null;
  entity_type: string;
  entity_id: string | null;
}

export interface DashboardResponse {
  period: { start: string; end: string };
  today: string;
  kpis: DashboardKpis;
  occupancy: { occupied: number; vacant: number; maintenance: number };
  income_by_day: DayPoint[];
  upcoming: UpcomingBooking[];
  activity: ActivityEntry[];
}

export interface SearchHit {
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export interface SearchResponse {
  query: string;
  condos: SearchHit[];
  bookings: SearchHit[];
  expenses: SearchHit[];
}

export interface CondoFinance {
  period: { start: string; end: string };
  revenue: string;
  expenses: string;
  net: string;
  net_is_negative: boolean;
  occupancy_pct: number;
  booked_nights: number;
  available_nights: number;
  bookings: number;
  upcoming: {
    id: string;
    guest_name: string;
    check_in: string;
    check_out: string;
    nights: number;
    total_label: string;
    payment_status: PaymentStatus;
  }[];
  recent_expenses: {
    id: string;
    description: string;
    category: string;
    tone: string;
    spent_on: string;
    amount_label: string;
    amount: string;
  }[];
}
