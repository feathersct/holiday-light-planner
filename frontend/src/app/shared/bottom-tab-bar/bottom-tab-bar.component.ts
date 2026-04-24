import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { User } from '../../models/listing.model';

@Component({
  selector: 'app-bottom-tab-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="position:fixed;bottom:0;left:0;right:0;z-index:900;background:white;
                border-top:1px solid #e9ecf0;display:flex;height:64px;
                padding-bottom:env(safe-area-inset-bottom);
                box-shadow:0 -2px 12px rgba(0,0,0,0.07);">
      <button *ngFor="let tab of tabs" (click)="navigate.emit(tab.id)"
              [style.color]="currentScreen === tab.id ? 'var(--accent-dark)' : '#94a3b8'"
              style="flex:1;display:flex;flex-direction:column;align-items:center;
                     justify-content:center;gap:3px;border:none;background:none;
                     cursor:pointer;transition:color 0.12s;padding:8px 0;">
        <div [style.opacity]="currentScreen === tab.id ? '1' : '0.6'"
             [style.transform]="currentScreen === tab.id ? 'scale(1.1)' : 'scale(1)'"
             style="transition:all 0.12s" [innerHTML]="tab.icon"></div>
        <span [style.font-weight]="currentScreen === tab.id ? '700' : '500'"
              style="font-size:10.5px">{{tab.label}}</span>
      </button>
    </div>
  `
})
export class BottomTabBarComponent {
  @Input() currentScreen = 'map';
  @Input() user: User | null = null;
  @Output() navigate = new EventEmitter<string>();

  get tabs() {
    const base = [
      { id: 'map', label: 'Explore', icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>` },
      { id: 'submit', label: 'Add', icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>` },
      { id: 'profile', label: 'Profile', icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>` },
    ];
    if (this.user?.role === 'ADMIN') {
      base.push({ id: 'admin', label: 'Admin', icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>` });
    }
    return base;
  }
}
