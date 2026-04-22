import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { User } from '../models/display.model';
import { environment } from '../../environments/environment';
import { UpvoteService } from './upvote.service';

export type AccentColor = 'amber' | 'teal' | 'coral';

export const ACCENT_MAP: Record<AccentColor, { accent: string; bg: string; dark: string; shadow: string }> = {
  amber: { accent: '#f59e0b', bg: '#fffbeb', dark: '#b45309', shadow: 'rgba(245,158,11,0.18)' },
  teal:  { accent: '#0d9488', bg: '#f0fdfa', dark: '#0f766e', shadow: 'rgba(13,148,136,0.18)' },
  coral: { accent: '#f97316', bg: '#fff7ed', dark: '#c2410c', shadow: 'rgba(249,115,22,0.18)' },
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private upvoteService = inject(UpvoteService);

  readonly currentUser = signal<User | null>(null);
  readonly accentColor = signal<AccentColor>('teal');
  readonly mapTiles = signal<'light' | 'dark' | 'standard'>('light');

  readonly isLoggedIn = computed(() => !!this.currentUser());
  readonly isAdmin = computed(() => this.currentUser()?.role === 'ADMIN');

  init(): void {
    this.http.get<{ success: boolean; data: User }>(`${environment.apiUrl}/api/v1/auth/me`)
      .subscribe({
        next: res => {
          this.currentUser.set(res.data);
          this.http.get<{ success: boolean; data: Array<{ id: number }> }>(`${environment.apiUrl}/api/v1/displays/upvoted`)
            .subscribe({ next: r => this.upvoteService.initFromIds(r.data.map(d => d.id)) });
        },
        error: () => this.currentUser.set(null),
      });
  }

  login(): void {
    window.location.href = `${environment.apiUrl}/oauth2/authorization/facebook`;
  }

  logout(): void {
    this.http.post(`${environment.apiUrl}/api/v1/auth/logout`, {})
      .subscribe({ complete: () => this.currentUser.set(null) });
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

  setTiles(tiles: string) {
    this.mapTiles.set(tiles as 'light' | 'dark' | 'standard');
  }
}
