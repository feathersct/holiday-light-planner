import { Injectable, signal, computed } from '@angular/core';
import { User } from '../models/display.model';

export const SAMPLE_USER: User = {
  id: 1, name: 'Alex Chen', avatar: 'AC',
  email: 'alex.chen@gmail.com', role: 'user',
  submitted: [1, 3], upvoted: [2, 4, 5], joined: 'November 2024',
};

export const ADMIN_USER: User = {
  id: 2, name: 'Jordan Park', avatar: 'JP',
  email: 'jordan@luminaryapp.com', role: 'admin',
  submitted: [], upvoted: [3, 5], joined: 'October 2024',
};

export type AccentColor = 'amber' | 'teal' | 'coral';

export const ACCENT_MAP: Record<AccentColor, { accent: string; bg: string; dark: string; shadow: string }> = {
  amber: { accent: '#f59e0b', bg: '#fffbeb', dark: '#b45309', shadow: 'rgba(245,158,11,0.18)' },
  teal:  { accent: '#0d9488', bg: '#f0fdfa', dark: '#0f766e', shadow: 'rgba(13,148,136,0.18)' },
  coral: { accent: '#f97316', bg: '#fff7ed', dark: '#c2410c', shadow: 'rgba(249,115,22,0.18)' },
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly authState = signal<'loggedOut' | 'user' | 'admin'>('loggedOut');
  readonly accentColor = signal<AccentColor>('teal');
  readonly mapTiles = signal<'light' | 'dark' | 'standard'>('light');

  readonly currentUser = computed<User | null>(() => {
    if (this.authState() === 'user') return SAMPLE_USER;
    if (this.authState() === 'admin') return ADMIN_USER;
    return null;
  });

  setAuthState(state: 'loggedOut' | 'user' | 'admin') {
    this.authState.set(state);
  }

  setAccent(color: string) {
    if (!Object.keys(ACCENT_MAP).includes(color)) return;
    this.accentColor.set(color as AccentColor);
    const a = ACCENT_MAP[color as AccentColor];
    const r = document.documentElement.style;
    r.setProperty('--accent', a.accent);
    r.setProperty('--accent-bg', a.bg);
    r.setProperty('--accent-dark', a.dark);
    r.setProperty('--accent-shadow', a.shadow);
  }

  setMapTiles(tiles: 'light' | 'dark' | 'standard') {
    this.mapTiles.set(tiles);
  }

  mockSignIn() {
    this.setAuthState('user');
  }

  signOut() {
    this.setAuthState('loggedOut');
  }

  setTiles(tiles: string) {
    this.mapTiles.set(tiles as 'light' | 'dark' | 'standard');
  }
}
