export interface Submitter {
  name: string;
  avatar: string;
}

export type DisplayType = 'drive-by' | 'walk-through' | 'both';

export interface Display {
  id: number;
  title: string;
  description: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  lat: number;
  lng: number;
  upvote_count: number;
  photo_count: number;
  display_type: DisplayType;
  tags: string[];
  best_time: string;
  submitter: Submitter;
  is_active: boolean;
}

export interface User {
  id: number;
  name: string;
  avatar: string;
  email: string;
  role: 'user' | 'admin';
  submitted: number[];
  upvoted: number[];
  joined: string;
}

export interface Report {
  id: number;
  display_id: number;
  display_title: string;
  reason: string;
  description: string;
  status: 'open' | 'reviewed' | 'resolved' | 'dismissed';
  reported_by: string;
  created_at: string;
}

export const TYPE_COLORS: Record<DisplayType, { bg: string; text: string; dot: string }> = {
  'drive-by':     { bg: '#dbeafe', text: '#1d4ed8', dot: '#3b82f6' },
  'walk-through': { bg: '#d1fae5', text: '#065f46', dot: '#10b981' },
  'both':         { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
};

export const TYPE_LABELS: Record<DisplayType, string> = {
  'drive-by': 'Drive-by',
  'walk-through': 'Walk-through',
  'both': 'Drive-by & Walk-through',
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

export const SAMPLE_DISPLAYS: Display[] = [
  {
    id: 1, title: 'Henderson Holiday House',
    description: 'Over 50,000 lights synchronized to holiday music broadcasting on FM 101.5. The whole street fills with cars each night. We\'ve been running this for 14 years and add something new every season — this year we added a tunnel of animated snowflakes.',
    address: '2847 Elm Street', city: 'Denver', state: 'CO', postcode: '80205',
    lat: 39.7520, lng: -104.9751, upvote_count: 847, photo_count: 12,
    display_type: 'drive-by', tags: ['animated', 'music-synced', 'inflatables'],
    best_time: 'Nightly 5pm–11pm, weekends until midnight',
    submitter: { name: 'James H.', avatar: 'JH' }, is_active: true,
  },
  {
    id: 2, title: 'Maple Street Magic',
    description: 'A walk-through winter wonderland with over 200 hand-crafted light sculptures and photo opportunities around every corner. Donations go to the local food pantry.',
    address: '1423 Maple Street', city: 'Denver', state: 'CO', postcode: '80206',
    lat: 39.7450, lng: -104.9680, upvote_count: 623, photo_count: 8,
    display_type: 'walk-through', tags: ['walk-through', 'family-friendly', 'charity'],
    best_time: 'Fri–Sun 6pm–10pm',
    submitter: { name: 'Sarah M.', avatar: 'SM' }, is_active: true,
  },
  {
    id: 3, title: 'Winter Wonderland Corner',
    description: 'The entire corner property transformed into a Christmas village. Rooftop projections cover the full facade plus 80,000 LEDs on every surface.',
    address: '5501 Park Avenue', city: 'Denver', state: 'CO', postcode: '80207',
    lat: 39.7580, lng: -104.9610, upvote_count: 1243, photo_count: 24,
    display_type: 'both', tags: ['animated', 'projections', 'rooftop', 'family-friendly'],
    best_time: 'Daily 5:30pm–10:30pm',
    submitter: { name: 'Mike W.', avatar: 'MW' }, is_active: true,
  },
  {
    id: 4, title: 'Kellerman\'s Corner',
    description: 'Classic neighborhood display running since 1998. Old-school multi-colored lights, a full nativity scene, and a hand-painted workshop.',
    address: '782 Oak Drive', city: 'Denver', state: 'CO', postcode: '80203',
    lat: 39.7390, lng: -104.9820, upvote_count: 312, photo_count: 3,
    display_type: 'drive-by', tags: ['family-friendly'],
    best_time: 'Every evening from dusk to 10pm',
    submitter: { name: 'Pat K.', avatar: 'PK' }, is_active: true,
  },
  {
    id: 5, title: 'The Light Farm',
    description: 'A full acre of hand-made light sculptures and tunnels, free to walk through. Donations accepted for the local food bank. Voted #1 in Denver two years running.',
    address: '9203 Sunrise Boulevard', city: 'Denver', state: 'CO', postcode: '80209',
    lat: 39.7650, lng: -104.9850, upvote_count: 2104, photo_count: 31,
    display_type: 'walk-through', tags: ['walk-through', 'animated', 'music-synced', 'charity', 'pet-friendly'],
    best_time: 'Nightly 5pm–10pm, closed Mon & Tue',
    submitter: { name: 'Anna L.', avatar: 'AL' }, is_active: true,
  },
  {
    id: 6, title: 'Riverside Rooftop Show',
    description: 'Incredible laser and video projections covering the rooftop and full facade. Best viewed from across the street — it runs on a 12-minute loop.',
    address: '340 River Road', city: 'Denver', state: 'CO', postcode: '80211',
    lat: 39.7710, lng: -104.9970, upvote_count: 561, photo_count: 7,
    display_type: 'drive-by', tags: ['projections', 'rooftop', 'animated'],
    best_time: '7pm–11pm nightly',
    submitter: { name: 'Chris R.', avatar: 'CR' }, is_active: true,
  },
  {
    id: 7, title: 'Snowflake Cul-de-Sac',
    description: 'Five houses on a dead-end street coordinated their displays — all different styles but choreographed as one unified installation with a shared music channel.',
    address: '12 Snowflake Circle', city: 'Denver', state: 'CO', postcode: '80212',
    lat: 39.7480, lng: -104.9930, upvote_count: 788, photo_count: 15,
    display_type: 'both', tags: ['animated', 'family-friendly', 'music-synced'],
    best_time: 'Daily 5pm–10pm',
    submitter: { name: 'Lisa F.', avatar: 'LF' }, is_active: true,
  },
  {
    id: 8, title: 'The Inflatable Kingdom',
    description: '40+ inflatables from classic Santas to obscure movie characters. A beloved neighborhood tradition for 8 years.',
    address: '678 Cedar Lane', city: 'Denver', state: 'CO', postcode: '80204',
    lat: 39.7400, lng: -104.9700, upvote_count: 445, photo_count: 9,
    display_type: 'drive-by', tags: ['inflatables', 'family-friendly'],
    best_time: 'Dusk to 10pm nightly',
    submitter: { name: 'Dave T.', avatar: 'DT' }, is_active: true,
  },
];

export const SAMPLE_REPORTS: Report[] = [
  { id: 1, display_id: 4, display_title: 'Kellerman\'s Corner', reason: 'wrong_address', description: 'This address is wrong — the display is actually two streets over on Oak Court, not Oak Drive.', status: 'open', reported_by: 'neighbor_2024', created_at: 'Dec 10, 2024' },
  { id: 2, display_id: 8, display_title: 'The Inflatable Kingdom', reason: 'spam', description: 'This looks like a duplicate — there\'s already a listing for the same address under a different name.', status: 'open', reported_by: 'visitor99', created_at: 'Dec 11, 2024' },
  { id: 3, display_id: 2, display_title: 'Maple Street Magic', reason: 'offensive', description: 'One of the newer decorations this year is inappropriate for a family audience.', status: 'reviewed', reported_by: 'parent_of_3', created_at: 'Dec 9, 2024' },
  { id: 4, display_id: 6, display_title: 'Riverside Rooftop Show', reason: 'other', description: 'The display is no longer running this season — confirmed by a neighbor.', status: 'resolved', reported_by: 'local42', created_at: 'Dec 8, 2024' },
  { id: 5, display_id: 1, display_title: 'Henderson Holiday House', reason: 'wrong_address', description: 'Street number appears to be 2874 not 2847 — map pin is slightly off.', status: 'dismissed', reported_by: 'mapchecker', created_at: 'Dec 7, 2024' },
];
