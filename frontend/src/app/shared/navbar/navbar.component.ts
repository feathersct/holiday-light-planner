import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AvatarComponent } from '../avatar/avatar.component';
import { User, getInitials } from '../../models/listing.model';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, AvatarComponent],
  template: `
    <nav style="height:58px;background:white;border-bottom:1px solid #e9ecf0;
                display:flex;align-items:center;padding:0 20px;
                position:fixed;top:0;left:0;right:0;z-index:1000;
                box-shadow:0 1px 8px rgba(0,0,0,0.06);">
      <!-- Logo -->
      <div (click)="navigate.emit('map')"
           style="display:flex;align-items:center;gap:9px;cursor:pointer;margin-right:28px">
        <div style="width:30px;height:30px;border-radius:8px;background:var(--accent);
                    display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="2.5" fill="rgba(255,255,255,0.35)"/>
          </svg>
        </div>
        <div style="display:flex;flex-direction:column;line-height:1.1">
          <span style="font-weight:800;font-size:14px;color:#0f172a;letter-spacing:-0.4px">Event Mapster</span>
          <span style="font-weight:600;font-size:9px;color:#94a3b8;letter-spacing:0.12em;text-transform:uppercase">eventmapster.com</span>
        </div>
      </div>

      <!-- Explore dropdown (desktop only) -->
      <div *ngIf="!isMobile" style="position:relative">
        <button type="button" (click)="$event.stopPropagation(); toggleExplore()"
                [style.background]="isExploreActive ? '#f1f5f9' : 'transparent'"
                [style.font-weight]="isExploreActive ? '700' : '500'"
                [style.color]="isExploreActive ? '#0f172a' : '#64748b'"
                style="border:none;padding:6px 13px;border-radius:7px;font-size:13.5px;
                       cursor:pointer;transition:all 0.1s;display:flex;align-items:center;gap:5px">
          Explore
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
        <div *ngIf="showExplore"
             style="position:absolute;top:calc(100% + 6px);left:0;background:white;
                    border:1px solid #e2e8f0;border-radius:10px;padding:6px;
                    box-shadow:0 8px 24px rgba(0,0,0,0.1);min-width:150px;z-index:100">
          <button type="button" (click)="navigate.emit('map'); showExplore = false"
                  style="display:block;width:100%;text-align:left;background:none;border:none;
                         padding:8px 12px;border-radius:7px;font-size:13.5px;color:#0f172a;cursor:pointer"
                  (mouseenter)="$any($event.target).style.background='#f1f5f9'"
                  (mouseleave)="$any($event.target).style.background='transparent'">
            Map
          </button>
          <button type="button" (click)="navigate.emit('hosts'); showExplore = false"
                  style="display:block;width:100%;text-align:left;background:none;border:none;
                         padding:8px 12px;border-radius:7px;font-size:13.5px;color:#0f172a;cursor:pointer"
                  (mouseenter)="$any($event.target).style.background='#f1f5f9'"
                  (mouseleave)="$any($event.target).style.background='transparent'">
            Organizers
          </button>
          <button *ngIf="user?.role === 'ADMIN'" type="button"
                  (click)="navigate.emit('admin'); showExplore = false"
                  style="display:block;width:100%;text-align:left;background:none;border:none;
                         padding:8px 12px;border-radius:7px;font-size:13.5px;color:#0f172a;cursor:pointer"
                  (mouseenter)="$any($event.target).style.background='#f1f5f9'"
                  (mouseleave)="$any($event.target).style.background='transparent'">
            Admin
          </button>
        </div>
      </div>

      <!-- Auth section -->
      <div style="margin-left:auto;display:flex;align-items:center">
        <ng-container *ngIf="user; else signInBtn">
          <div style="position:relative">
            <div (click)="$event.stopPropagation(); toggleAccount()" style="cursor:pointer">
              <app-avatar [initials]="getInitials(user.name)" [size]="32"/>
            </div>
            <!-- Desktop avatar dropdown -->
            <div *ngIf="showAccount && !isMobile"
                 style="position:absolute;top:calc(100% + 10px);right:0;background:white;
                        border:1px solid #e2e8f0;border-radius:10px;padding:6px;
                        box-shadow:0 8px 24px rgba(0,0,0,0.1);min-width:150px;z-index:100">
              <button type="button" (click)="navigate.emit('profile'); showAccount = false"
                      style="display:block;width:100%;text-align:left;background:none;border:none;
                             padding:8px 12px;border-radius:7px;font-size:13.5px;color:#0f172a;cursor:pointer"
                      (mouseenter)="$any($event.target).style.background='#f1f5f9'"
                      (mouseleave)="$any($event.target).style.background='transparent'">
                My Account
              </button>
              <div style="height:1px;background:#f1f5f9;margin:4px 0"></div>
              <button type="button" data-testid="sign-out-btn" (click)="signOut.emit(); showAccount = false"
                      style="display:block;width:100%;text-align:left;background:none;border:none;
                             padding:8px 12px;border-radius:7px;font-size:13.5px;color:#64748b;cursor:pointer"
                      (mouseenter)="$any($event.target).style.background='#f1f5f9'"
                      (mouseleave)="$any($event.target).style.background='transparent'">
                Sign out
              </button>
            </div>
          </div>
        </ng-container>
        <ng-template #signInBtn>
          <button type="button" (click)="authAction.emit()"
                  style="background:#0f172a;color:white;border:none;padding:7px 18px;
                         border-radius:8px;font-size:13.5px;font-weight:600;cursor:pointer;
                         display:flex;align-items:center;gap:6px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
            Sign in
          </button>
        </ng-template>
      </div>
    </nav>

    <!-- Mobile account bottom sheet -->
    <ng-container *ngIf="showAccount && isMobile && user">
      <div (click)="showAccount = false"
           style="position:fixed;inset:0;z-index:1100;background:rgba(0,0,0,0.3)"></div>
      <div style="position:fixed;bottom:0;left:0;right:0;z-index:1200;background:white;
                  border-radius:20px 20px 0 0;
                  padding:12px 16px calc(16px + env(safe-area-inset-bottom))">
        <div style="width:40px;height:4px;border-radius:99px;background:#cbd5e1;margin:0 auto 16px"></div>
        <div style="font-size:12px;font-weight:600;color:#94a3b8;text-transform:uppercase;
                    letter-spacing:0.06em;padding:0 4px;margin-bottom:8px">Account</div>
        <button type="button" (click)="navigate.emit('profile'); showAccount = false"
                style="display:block;width:100%;text-align:left;background:none;border:none;
                       padding:14px;border-radius:10px;font-size:15px;font-weight:600;
                       color:#0f172a;cursor:pointer">
          My Account
        </button>
        <div style="height:1px;background:#f1f5f9;margin:4px 0"></div>
        <button type="button" (click)="signOut.emit(); showAccount = false"
                style="display:block;width:100%;text-align:left;background:none;border:none;
                       padding:14px;border-radius:10px;font-size:15px;font-weight:500;
                       color:#64748b;cursor:pointer">
          Sign out
        </button>
      </div>
    </ng-container>
  `
})
export class NavbarComponent {
  @Input() currentScreen = 'map';
  @Input() user: User | null = null;
  @Input() isMobile = false;

  getInitials = getInitials;
  showExplore = false;
  showAccount = false;

  @Output() navigate = new EventEmitter<string>();
  @Output() authAction = new EventEmitter<void>();
  @Output() signOut = new EventEmitter<void>();

  @HostListener('document:click')
  closeDropdowns() {
    this.showExplore = false;
    this.showAccount = false;
  }

  get isExploreActive() {
    return ['map', 'hosts', 'admin'].includes(this.currentScreen);
  }

  toggleExplore() {
    this.showExplore = !this.showExplore;
    this.showAccount = false;
  }

  toggleAccount() {
    this.showAccount = !this.showAccount;
    this.showExplore = false;
  }
}
