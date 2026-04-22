// ── Core types matching backend DTOs ──────────────────────────────────────

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

/** Returned by GET /displays/search, /displays/mine, /displays/upvoted */
export interface DisplaySummary {
  id: number;
  title: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  upvoteCount: number;
  photoCount: number;
  displayType: string;
  primaryPhotoUrl: string | null;
  tags: Tag[];
}

/** Returned by GET /displays/:id */
export interface Display extends DisplaySummary {
  submittedBy: number;
  description: string;
  address: string;
  postcode: string;
  bestTime: string;
  isActive: boolean;
  createdAt: string;
  photos: Photo[];
}

export interface User {
  id: number;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: 'USER' | 'ADMIN';
}

export interface Report {
  id: number;
  displayId: number;
  displayTitle: string;
  reporterId: number;
  reporterName: string;
  reason: string;
  notes: string;
  status: string;
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
  displayType?: string;
  page?: number;
  size?: number;
}

export interface CreateDisplayRequest {
  title: string;
  description: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  lat: number;
  lng: number;
  bestTime: string;
  displayType: string;
  tagIds: number[];
}

// ── Display helpers ────────────────────────────────────────────────────────

export const TYPE_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  'DRIVE_BY':     { bg: '#dbeafe', text: '#1d4ed8', dot: '#3b82f6' },
  'WALK_THROUGH': { bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
  'BOTH':         { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
};

export const TYPE_LABELS: Record<string, string> = {
  'DRIVE_BY':     'Drive-by',
  'WALK_THROUGH': 'Walk-through',
  'BOTH':         'Combined',
};

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

// ── Legacy sample data (kept for reference, not used in production) ───────

export const SAMPLE_DISPLAYS: DisplaySummary[] = [];
export const SAMPLE_REPORTS: Report[] = [];
