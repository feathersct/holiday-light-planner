import { Component, Input, Output, EventEmitter, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AvatarComponent } from '../avatar/avatar.component';
import { User, getInitials } from '../../models/listing.model';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, AvatarComponent],
  template: `
    <nav style="height:58px;background:white;border-bottom:1px solid #e9ecf0;
                display:flex;align-items:center;padding:0 20px;
                position:fixed;top:0;left:0;right:0;z-index:1000;
                box-shadow:0 1px 8px rgba(0,0,0,0.06);">
      <!-- Logo -->
      <div (click)="navigate.emit('map')"
           style="display:flex;align-items:center;gap:9px;cursor:pointer;margin-right:28px">
        <div style="width:30px;height:30px;border-radius:8px;
                    background:linear-gradient(135deg,var(--accent) 0%,#ef4444 100%);
                    display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M17.66 6.34l-1.41 1.41M6.34 17.66l-1.41 1.41" stroke="white" stroke-width="2"/>
          </svg>
        </div>
        <div style="display:flex;flex-direction:column;line-height:1.1">
          <span style="font-weight:800;font-size:14px;color:#0f172a;letter-spacing:-0.4px">Event</span>
          <span style="font-weight:600;font-size:9px;color:#94a3b8;letter-spacing:0.12em;text-transform:uppercase">Mapster</span>
        </div>
      </div>

      <!-- Desktop nav links -->
      <div *ngIf="!isMobile" style="display:flex;gap:2px;flex:1">
        <button *ngFor="let link of navLinks"
                (click)="navigate.emit(link.id)"
                [style.background]="currentScreen === link.id ? '#f1f5f9' : 'transparent'"
                [style.font-weight]="currentScreen === link.id ? '700' : '500'"
                [style.color]="currentScreen === link.id ? '#0f172a' : '#64748b'"
                style="border:none;padding:6px 13px;border-radius:7px;font-size:13.5px;
                       cursor:pointer;transition:all 0.1s">
          {{link.label}}
        </button>
      </div>

      <!-- Auth -->
      <div *ngIf="user; else signInBtn" style="display:flex;align-items:center;gap:10px;margin-left:auto">
        <app-avatar [initials]="getInitials(user.name)" [size]="32"/>
        <button (click)="authAction.emit()"
                style="background:none;border:1.5px solid #e5e7eb;padding:5px 12px;
                       border-radius:7px;font-size:12.5px;color:#64748b;cursor:pointer">
          Sign out
        </button>
      </div>
      <ng-template #signInBtn>
        <button (click)="authAction.emit()"
                style="background:#0f172a;color:white;border:none;padding:7px 18px;
                       border-radius:8px;font-size:13.5px;font-weight:600;cursor:pointer;
                       display:flex;align-items:center;gap:6px;margin-left:auto">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
            <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
          Sign in
        </button>
      </ng-template>
    </nav>
  `
})
export class NavbarComponent {
  @Input() currentScreen = 'map';
  @Input() user: User | null = null;
  @Input() isMobile = false;

  getInitials = getInitials;

  @Output() navigate = new EventEmitter<string>();
  @Output() authAction = new EventEmitter<void>();

  get navLinks() {
    return [
      { id: 'map', label: 'Explore' },
      ...(this.user ? [{ id: 'submit', label: 'Add Display' }] : []),
      ...(this.user ? [{ id: 'profile', label: 'My Displays' }] : []),
      ...(this.user?.role === 'ADMIN' ? [{ id: 'admin', label: '⚙ Admin' }] : []),
    ];
  }
}
