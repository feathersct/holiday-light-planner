export type Category =
  | 'CHRISTMAS_LIGHTS'
  | 'YARD_SALE'
  | 'ESTATE_SALE'
  | 'POPUP_MARKET'
  | 'FOOD_TRUCK';

export const CATEGORY_LABELS: Record<Category, string> = {
  CHRISTMAS_LIGHTS: 'Christmas Lights',
  YARD_SALE:        'Yard / Garage Sale',
  ESTATE_SALE:      'Estate Sale',
  POPUP_MARKET:     'Pop-up Market',
  FOOD_TRUCK:       'Food Truck',
};

export const CATEGORY_COLORS: Record<Category, { bg: string; text: string; dot: string; marker: string }> = {
  CHRISTMAS_LIGHTS: { bg: '#fee2e2', text: '#991b1b', dot: '#ef4444', marker: '#ef4444' },
  YARD_SALE:        { bg: '#dcfce7', text: '#166534', dot: '#22c55e', marker: '#22c55e' },
  ESTATE_SALE:      { bg: '#f3e8ff', text: '#6b21a8', dot: '#a855f7', marker: '#a855f7' },
  POPUP_MARKET:     { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6', marker: '#3b82f6' },
  FOOD_TRUCK:       { bg: '#fff7ed', text: '#9a3412', dot: '#f97316', marker: '#f97316' },
};

export interface Tag {
  id: number;
  name: string;
}

export interface Photo {
  id: number;
  url: string;
  isPrimary: boolean;
}

export type DisplayType = 'DRIVE_BY' | 'WALK_THROUGH' | 'BOTH';

export const TYPE_LABELS: Record<string, string> = {
  DRIVE_BY:     'Drive-by',
  WALK_THROUGH: 'Walk-through',
  BOTH:         'Combined',
};

/** Returned by GET /listings/search, /listings/mine, /listings/upvoted */
export interface ListingSummary {
  id: number;
  title: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  upvoteCount: number;
  photoCount: number;
  category: Category;
  displayType: string | null;
  primaryPhotoUrl: string | null;
  tags: Tag[];
  isActive: boolean;
  startDatetime: string;
  endDatetime: string;
  priceInfo: string | null;
  cuisineType: string | null;
  organizer: string | null;
  websiteUrl: string | null;
  resolvedHostName: string;
}

/** Returned by GET /listings/:id */
export interface Listing extends ListingSummary {
  submittedBy: number;
  submittedByName: string;
  submittedByAvatarUrl: string | null;
  submittedByHandle: string | null;
  description: string;
  address: string;
  postcode: string;
  bestTime: string | null;
  createdAt: string;
  photos: Photo[];
}

export interface User {
  id: number;
  name: string;
  email: string;
  avatarUrl: string | null;
  displayName: string | null;
  role: 'USER' | 'ADMIN';
}

export interface Report {
  id: number;
  listingId: number;
  listingTitle: string;
  reporterId: number;
  reporterName: string;
  reason: string;
  notes: string;
  status: string;
  createdAt: string;
}

export interface HostUser {
  id: number;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  handle: string | null;
}

export type HostSearchResult = HostUser;

export interface HostListingsResponse {
  user: HostUser;
  listings: ListingSummary[];
}

export interface HostEntity {
  id: number;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  listingCount: number;
  createdAt: string;
}

export interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface SearchParams {
  lat: number;
  lng: number;
  radiusMiles?: number;
  tags?: number[];
  category?: Category | '';
  page?: number;
  size?: number;
}

export interface InitialFilters {
  category?: Category;
  lat?: number;
  lng?: number;
  radius?: number;
  tags?: string[];
}

export interface FilterState {
  category: Category | '';
  tags: string[];
  lat: number;
  lng: number;
  radius: number;
}

export interface CreateListingRequest {
  category: Category;
  title: string;
  description: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  lat: number;
  lng: number;
  startDatetime: string;
  endDatetime: string;
  priceInfo: string;
  // Christmas Lights only
  bestTime: string;
  displayType: string;
  tagIds: number[];
  // Food Truck only
  cuisineType: string;
  // Estate Sale only
  organizer: string;
  // Christmas Lights + Food Truck only
  websiteUrl: string;
  hostName: string;
  hostId?: number | null;
}

export interface UpdateListingRequest {
  category: Category;
  title: string;
  description: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  lat: number;
  lng: number;
  startDatetime: string;
  endDatetime: string;
  priceInfo: string;
  bestTime: string;
  displayType: string;
  tagIds: number[];
  cuisineType: string;
  organizer: string;
  websiteUrl: string;
  hostName: string;
  hostId?: number | null;
}

export const TAG_STYLES: Record<string, { bg: string; text: string }> = {
  'animated':        { bg: '#e0e7ff', text: '#3730a3' },
  'music-synced':    { bg: '#fce7f3', text: '#9d174d' },
  'walk-through':    { bg: '#d1fae5', text: '#065f46' },
  'inflatables':     { bg: '#fff7ed', text: '#9a3412' },
  'projections':     { bg: '#f3e8ff', text: '#6b21a8' },
  'rooftop':         { bg: '#e0f2fe', text: '#075985' },
  'family-friendly': { bg: '#dcfce7', text: '#166534' },
  'pet-friendly':    { bg: '#fef9c3', text: '#713f12' },
  'charity':         { bg: '#ffe4e6', text: '#9f1239' },
};

export const ALL_TAGS = [
  'animated', 'music-synced', 'walk-through', 'inflatables',
  'projections', 'rooftop', 'family-friendly', 'pet-friendly', 'charity',
];

export function getInitials(name: string): string {
  return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2) || '?';
}

export function isExpired(listing: ListingSummary): boolean {
  return new Date(listing.endDatetime) < new Date();
}

export function isUpcoming(listing: ListingSummary): boolean {
  return new Date(listing.startDatetime) > new Date();
}

export function formatDateRange(start: string, end: string): string {
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const s = new Date(start), e = new Date(end);
  if (s.toDateString() === e.toDateString()) return fmt(s);
  return `${fmt(s)} – ${fmt(e)}`;
}

export function formatTimeRange(start: string, end: string): string | null {
  const s = new Date(start), e = new Date(end);
  const midnight = (d: Date) => d.getHours() === 0 && d.getMinutes() === 0;
  if (midnight(s) && midnight(e)) return null;
  const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${fmt(s)} – ${fmt(e)}`;
}
