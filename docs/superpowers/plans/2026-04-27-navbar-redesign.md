# Navbar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the navbar by introducing an Explore dropdown, replacing the standalone account link and sign-out button with an avatar dropdown/bottom sheet, and moving "Add Display" to a map FAB.

**Architecture:** All changes are frontend-only. The navbar is rebuilt with two dropdowns (Explore and avatar). A new `signOut` output is added to `NavbarComponent`. The map component gains an `addDisplay` output and FAB button. The bottom tab bar is reduced to two tabs.

**Tech Stack:** Angular 17 standalone components, signals, inline templates, CommonModule

---

## File Map

| File | Change |
|---|---|
| `frontend/src/app/shared/navbar/navbar.component.ts` | Rebuild: Explore dropdown, avatar dropdown/bottom sheet, new `signOut` output |
| `frontend/src/app/shared/bottom-tab-bar/bottom-tab-bar.component.ts` | Reduce to 2 tabs: Explore + Organizers (Admin tab kept for admin users) |
| `frontend/src/app/pages/map/map.component.ts` | Add `addDisplay` output + FAB button (both mobile and desktop layouts) |
| `frontend/src/app/app.component.ts` | Wire `(addDisplay)` on map, wire `(signOut)` on navbar, simplify `onAuthAction` |
| `frontend/src/app/pages/host-search/host-search.component.ts` | Rename "Find a Host" → "Find an Organizer", update subtitle |

---

## Task 1: Rename "Hosts" → "Organizers" in host-search page

**Files:**
- Modify: `frontend/src/app/pages/host-search/host-search.component.ts:16-18`

- [ ] **Step 1: Update the page title and subtitle**

In `host-search.component.ts`, replace lines 16–18:

```typescript
        <div style="font-weight:800;font-size:22px;color:#0f172a;margin-bottom:4px">Find an Organizer</div>
        <div style="font-size:13.5px;color:#64748b;margin-bottom:24px">
          Search for an organizer by name.
        </div>
```

- [ ] **Step 2: Verify visually**

Run `npm start` from `frontend/` and open http://localhost:4200. Navigate to Hosts. Confirm the page title reads "Find an Organizer".

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/pages/host-search/host-search.component.ts
git commit -m "feat: rename Hosts to Organizers in host-search page"
```

---

## Task 2: Add `addDisplay` output and FAB to map component

**Files:**
- Modify: `frontend/src/app/pages/map/map.component.ts`
- Test: `frontend/src/app/pages/map/map.component.spec.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `frontend/src/app/pages/map/map.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MapComponent } from './map.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';

describe('MapComponent', () => {
  let fixture: ComponentFixture<MapComponent>;
  let component: MapComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapComponent, HttpClientTestingModule],
    }).compileComponents();
    fixture = TestBed.createComponent(MapComponent);
    component = fixture.componentInstance;
    component.isMobile = false;
    fixture.detectChanges();
  });

  it('emits addDisplay when FAB is clicked', () => {
    component.user = { id: 1, name: 'Test', email: 'test@test.com', role: 'USER' } as any;
    fixture.detectChanges();
    let emitted = false;
    component.addDisplay.subscribe(() => emitted = true);
    const fab = fixture.debugElement.query(By.css('[data-testid="add-display-fab"]'));
    expect(fab).toBeTruthy();
    fab.nativeElement.click();
    expect(emitted).toBeTrue();
  });

  it('hides FAB when user is null', () => {
    component.user = null;
    fixture.detectChanges();
    const fab = fixture.debugElement.query(By.css('[data-testid="add-display-fab"]'));
    expect(fab).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx ng test --include="**/map.component.spec.ts" --watch=false
```

Expected: FAIL — `addDisplay` not yet defined.

- [ ] **Step 3: Add `addDisplay` output to map component**

In `map.component.ts`, the `@Output()` declarations are around line 380–384. Add one more:

```typescript
  @Output() addDisplay = new EventEmitter<void>();
```

- [ ] **Step 4: Add FAB to mobile layout**

In `map.component.ts`, find the closing `</div>` of the mobile layout at line ~154 (the line just before `<!-- ── Desktop layout ── -->`). Insert the FAB just before it, still inside the `*ngIf="isMobile"` container:

```html
      <!-- Add Display FAB -->
      <button *ngIf="user" data-testid="add-display-fab"
              (click)="addDisplay.emit()"
              style="position:absolute;bottom:16px;right:16px;z-index:600;
                     background:#0f172a;color:white;border:none;border-radius:10px;
                     padding:10px 16px;font-size:13px;font-weight:700;cursor:pointer;
                     display:flex;align-items:center;gap:6px;
                     box-shadow:0 4px 16px rgba(0,0,0,0.2)">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Add Display
      </button>
```

- [ ] **Step 5: Add FAB to desktop layout**

In `map.component.ts`, find the closing `</div>` of `<div #mapContainer style="flex:1;position:relative">` (around line 290, just after the Plan a Tour button section). Insert the FAB just before it:

```html
        <!-- Add Display FAB -->
        <button *ngIf="user" data-testid="add-display-fab"
                (click)="addDisplay.emit()"
                style="position:absolute;bottom:80px;right:24px;z-index:10;
                       background:#0f172a;color:white;border:none;border-radius:10px;
                       padding:10px 18px;font-size:13.5px;font-weight:700;cursor:pointer;
                       display:flex;align-items:center;gap:7px;
                       box-shadow:0 4px 20px rgba(0,0,0,0.2);transition:box-shadow 0.15s"
                (mouseenter)="$any($event.target).style.boxShadow='0 8px 28px rgba(0,0,0,0.3)'"
                (mouseleave)="$any($event.target).style.boxShadow='0 4px 20px rgba(0,0,0,0.2)'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Display
        </button>
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd frontend && npx ng test --include="**/map.component.spec.ts" --watch=false
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/pages/map/map.component.ts frontend/src/app/pages/map/map.component.spec.ts
git commit -m "feat: add Add Display FAB to map component"
```

---

## Task 3: Wire map FAB and navbar signOut in app.component

**Files:**
- Modify: `frontend/src/app/app.component.ts`

- [ ] **Step 1: Add `(addDisplay)` binding to the map element**

In `app.component.ts`, find the `<app-map>` element (around line 54). Add the new output binding:

```html
      <app-map *ngIf="screen() === 'map'"
        [user]="authService.currentUser()"
        [mapTiles]="authService.mapTiles()"
        [initialFilters]="initialFilters"
        style="display:block;height:100%"
        (needAuth)="showSignIn.set(true)"
        (viewDetails)="openDetail($event)"
        (upvoteToggle)="upvoteService.toggle($event)"
        (filtersChanged)="onFiltersChanged($event)"
        (addDisplay)="navigate('submit')"/>
```

- [ ] **Step 2: Add `(signOut)` binding to navbar and simplify `onAuthAction`**

In `app.component.ts`, update the `<app-navbar>` element (line ~46):

```html
    <app-navbar [currentScreen]="screen()" [user]="authService.currentUser()" [isMobile]="isMobile"
      (navigate)="navigate($event)" (authAction)="onAuthAction()" (signOut)="onSignOut()"/>
```

Then update the `onAuthAction` method and add `onSignOut` (around line 253):

```typescript
  onAuthAction() {
    this.showSignIn.set(true);
  }

  onSignOut() {
    this.authService.logout();
  }
```

- [ ] **Step 3: Verify end-to-end**

Run `npm start` from `frontend/`. Verify:
- Clicking "+ Add Display" FAB on the map navigates to the submit screen (when logged in)
- FAB is hidden when logged out

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/app.component.ts
git commit -m "feat: wire map FAB and navbar signOut in app component"
```

---

## Task 4: Rebuild navbar with Explore dropdown and avatar dropdown/bottom sheet

**Files:**
- Modify: `frontend/src/app/shared/navbar/navbar.component.ts`
- Test: `frontend/src/app/shared/navbar/navbar.component.spec.ts` (create)

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/app/shared/navbar/navbar.component.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavbarComponent } from './navbar.component';
import { By } from '@angular/platform-browser';

const mockUser = { id: 1, name: 'Test User', email: 'test@test.com', role: 'USER' } as any;

describe('NavbarComponent', () => {
  let fixture: ComponentFixture<NavbarComponent>;
  let component: NavbarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavbarComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(NavbarComponent);
    component = fixture.componentInstance;
    component.isMobile = false;
    fixture.detectChanges();
  });

  it('emits signOut when Sign out is clicked in avatar dropdown', () => {
    component.user = mockUser;
    fixture.detectChanges();
    component.showAccount = true;
    fixture.detectChanges();
    let emitted = false;
    component.signOut.subscribe(() => emitted = true);
    const btn = fixture.debugElement.queryAll(By.css('button'))
      .find(b => b.nativeElement.textContent.trim() === 'Sign out');
    expect(btn).toBeTruthy();
    btn!.nativeElement.click();
    expect(emitted).toBeTrue();
  });

  it('emits navigate("profile") when My Account is clicked', () => {
    component.user = mockUser;
    fixture.detectChanges();
    component.showAccount = true;
    fixture.detectChanges();
    let navigatedTo = '';
    component.navigate.subscribe((s: string) => navigatedTo = s);
    const btn = fixture.debugElement.queryAll(By.css('button'))
      .find(b => b.nativeElement.textContent.trim() === 'My Account');
    expect(btn).toBeTruthy();
    btn!.nativeElement.click();
    expect(navigatedTo).toBe('profile');
  });

  it('emits navigate("hosts") from Explore dropdown', () => {
    component.user = mockUser;
    fixture.detectChanges();
    component.showExplore = true;
    fixture.detectChanges();
    let navigatedTo = '';
    component.navigate.subscribe((s: string) => navigatedTo = s);
    const btn = fixture.debugElement.queryAll(By.css('button'))
      .find(b => b.nativeElement.textContent.trim() === 'Organizers');
    expect(btn).toBeTruthy();
    btn!.nativeElement.click();
    expect(navigatedTo).toBe('hosts');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npx ng test --include="**/navbar.component.spec.ts" --watch=false
```

Expected: FAIL — `signOut`, `showAccount`, `showExplore` not yet defined.

- [ ] **Step 3: Replace navbar.component.ts**

Replace the entire content of `frontend/src/app/shared/navbar/navbar.component.ts`:

```typescript
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
        <button (click)="$event.stopPropagation(); toggleExplore()"
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
          <button (click)="navigate.emit('map'); showExplore = false"
                  style="display:block;width:100%;text-align:left;background:none;border:none;
                         padding:8px 12px;border-radius:7px;font-size:13.5px;color:#0f172a;cursor:pointer"
                  (mouseenter)="$any($event.target).style.background='#f1f5f9'"
                  (mouseleave)="$any($event.target).style.background='transparent'">
            Map
          </button>
          <button (click)="navigate.emit('hosts'); showExplore = false"
                  style="display:block;width:100%;text-align:left;background:none;border:none;
                         padding:8px 12px;border-radius:7px;font-size:13.5px;color:#0f172a;cursor:pointer"
                  (mouseenter)="$any($event.target).style.background='#f1f5f9'"
                  (mouseleave)="$any($event.target).style.background='transparent'">
            Organizers
          </button>
          <button *ngIf="user?.role === 'ADMIN'"
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
              <button (click)="navigate.emit('profile'); showAccount = false"
                      style="display:block;width:100%;text-align:left;background:none;border:none;
                             padding:8px 12px;border-radius:7px;font-size:13.5px;color:#0f172a;cursor:pointer"
                      (mouseenter)="$any($event.target).style.background='#f1f5f9'"
                      (mouseleave)="$any($event.target).style.background='transparent'">
                My Account
              </button>
              <div style="height:1px;background:#f1f5f9;margin:4px 0"></div>
              <button (click)="signOut.emit(); showAccount = false"
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
          <button (click)="authAction.emit()"
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
        <button (click)="navigate.emit('profile'); showAccount = false"
                style="display:block;width:100%;text-align:left;background:none;border:none;
                       padding:14px;border-radius:10px;font-size:15px;font-weight:600;
                       color:#0f172a;cursor:pointer">
          My Account
        </button>
        <div style="height:1px;background:#f1f5f9;margin:4px 0"></div>
        <button (click)="signOut.emit(); showAccount = false"
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npx ng test --include="**/navbar.component.spec.ts" --watch=false
```

Expected: PASS (3 tests)

- [ ] **Step 5: Verify visually**

Run `npm start` and verify on desktop:
- "Explore ▾" button opens dropdown with Map and Organizers
- Clicking avatar opens dropdown with My Account and Sign Out
- Clicking outside closes both dropdowns

On mobile (resize window < 768px):
- Explore dropdown is hidden
- Clicking avatar opens bottom sheet with My Account and Sign Out

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/shared/navbar/navbar.component.ts frontend/src/app/shared/navbar/navbar.component.spec.ts
git commit -m "feat: rebuild navbar with Explore dropdown and avatar dropdown/bottom sheet"
```

---

## Task 5: Simplify bottom tab bar to Explore + Organizers

**Files:**
- Modify: `frontend/src/app/shared/bottom-tab-bar/bottom-tab-bar.component.ts`

- [ ] **Step 1: Replace the `tabs` getter**

In `bottom-tab-bar.component.ts`, replace the entire `get tabs()` getter with:

```typescript
  get tabs() {
    const base = [
      { id: 'map', label: 'Explore', icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>` },
      { id: 'hosts', label: 'Organizers', icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>` },
    ];
    if (this.user?.role === 'ADMIN') {
      base.push({ id: 'admin', label: 'Admin', icon: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>` });
    }
    return base;
  }
```

- [ ] **Step 2: Verify visually on mobile**

Resize the browser below 768px. Bottom tab bar should show only "Explore" and "Organizers" (2 tabs). Admin users see 3 tabs.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/shared/bottom-tab-bar/bottom-tab-bar.component.ts
git commit -m "feat: reduce mobile tab bar to Explore and Organizers"
```

---

## Self-Review Checklist

- **Spec coverage:**
  - ✅ Desktop Explore dropdown (Map, Organizers, Admin for admins)
  - ✅ Avatar dropdown (My Account, Sign Out) on desktop
  - ✅ Mobile bottom sheet (My Account, Sign Out) on mobile
  - ✅ Map FAB (+ Add Display, logged-in only, mobile + desktop)
  - ✅ Desktop FAB positioned above settings gear (bottom:80px)
  - ✅ Bottom tab bar reduced to Explore + Organizers
  - ✅ Rename "Hosts" → "Organizers" in host-search page
  - ✅ Rename "My Displays" → "My Account" (via avatar dropdown)
  - ✅ Add Display removed from nav (FAB replaces it)
  - ✅ "Add" tab removed from mobile tab bar

- **No placeholders:** All steps have complete code.

- **Type consistency:** `navigate.emit('hosts')` used consistently for the Organizers screen. `navigate.emit('profile')` used consistently for My Account. These match the existing `Screen` type and `navigate()` handler in app.component.
