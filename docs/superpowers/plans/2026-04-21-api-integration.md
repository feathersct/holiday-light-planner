# API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Angular frontend to the real Spring Boot backend — replace all mock data with HttpClient calls, implement real OAuth2 login, and connect every screen to its corresponding API endpoint.

**Architecture:** The frontend already has all UI built with mock data. This plan replaces `SAMPLE_DISPLAYS`/`SAMPLE_REPORTS`/mock auth with real HTTP calls. A credentials interceptor adds `withCredentials: true` to every request so the HttpOnly JWT cookie travels automatically. The backend OAuth2 flow is a full-page redirect to `/oauth2/authorization/google` — the Angular app does not handle tokens directly. Two new backend endpoints (`/displays/mine`, `/displays/upvoted`) are added first since the profile page needs them.

**Tech Stack:** Angular 17 standalone, Angular HttpClient, Spring Boot 3.5, HttpOnly JWT cookie, Nominatim geocoding (free, no key), Leaflet.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `backend/src/main/java/com/christmaslightmap/service/DisplayService.java` | Modify | Add `getMyDisplays()` and `getUpvotedDisplays()` |
| `backend/src/main/java/com/christmaslightmap/controller/DisplayController.java` | Modify | Add `GET /api/v1/displays/mine` and `/upvoted` |
| `frontend/src/environments/environment.ts` | Create | Production API URL |
| `frontend/src/environments/environment.development.ts` | Create | Dev API URL (localhost:8080) |
| `frontend/angular.json` | Modify | File replacements for dev config |
| `frontend/src/app/core/interceptors/credentials.interceptor.ts` | Create | Adds `withCredentials: true` to all requests |
| `frontend/src/app/app.config.ts` | Modify | Register interceptor |
| `frontend/src/app/models/display.model.ts` | Modify | Camelcase interfaces matching backend DTOs |
| `frontend/src/app/shared/display-card/display-card.component.ts` | Modify | Camelcase props, `tag.name`, `city+state` |
| `frontend/src/app/shared/display-detail/display-detail.component.ts` | Modify | Camelcase props, `tag.name`, loads full display from API |
| `frontend/src/app/shared/navbar/navbar.component.ts` | Modify | Compute initials from `user.name` |
| `frontend/src/app/services/auth.service.ts` | Modify | Real HTTP: `init()`, `login()`, `logout()` |
| `frontend/src/app/services/upvote.service.ts` | Modify | Real HTTP with optimistic UI |
| `frontend/src/app/services/display-api.service.ts` | Create | All display/tag/report HTTP methods |
| `frontend/src/app/app.component.ts` | Modify | `ngOnInit → authService.init()`, OAuth redirect |
| `frontend/src/app/shared/sign-in-modal/sign-in-modal.component.ts` | Modify | Redirect to real OAuth URL |
| `frontend/src/app/pages/map/map.component.ts` | Modify | Search API on map move, load tags from API |
| `frontend/src/app/shared/display-detail/display-detail.component.ts` | Modify | Load full display by ID on open |
| `frontend/src/app/pages/submit/submit.component.ts` | Modify | Geocode + POST to create API |
| `frontend/src/app/pages/profile/profile.component.ts` | Modify | Load my/upvoted displays from API |
| `frontend/src/app/pages/admin/admin.component.ts` | Modify | Load + update reports from API |

---

## Task 1: Backend — Profile Endpoints

**Files:**
- Modify: `backend/src/main/java/com/christmaslightmap/service/DisplayService.java`
- Modify: `backend/src/main/java/com/christmaslightmap/controller/DisplayController.java`

- [ ] **Step 1: Add `getMyDisplays` and `getUpvotedDisplays` to DisplayService**

  `DisplayService` already injects `DisplayRepository` and `DisplayPhotoRepository`. Add `UpvoteRepository` injection and two new methods. The existing class starts with:
  ```java
  private final DisplayRepository displayRepository;
  private final UserRepository userRepository;
  private final TagRepository tagRepository;
  private final DisplayPhotoRepository displayPhotoRepository;
  ```
  Add `UpvoteRepository upvoteRepository;` as a fifth field (Lombok `@RequiredArgsConstructor` picks it up automatically).

  Then add these two methods at the bottom of the class (before the closing `}`), after the existing `mapRowToSummary` method:

  ```java
  public List<DisplaySummaryResponse> getMyDisplays(Long userId) {
      return displayRepository.findByUserIdAndIsActiveTrue(userId).stream()
          .map(this::mapDisplayToSummary)
          .collect(Collectors.toList());
  }

  public List<DisplaySummaryResponse> getUpvotedDisplays(Long userId) {
      return upvoteRepository.findByUserIdWithActiveDisplays(userId).stream()
          .map(u -> mapDisplayToSummary(u.getDisplay()))
          .collect(Collectors.toList());
  }

  private DisplaySummaryResponse mapDisplayToSummary(Display display) {
      String primaryPhotoUrl = displayPhotoRepository.findByDisplay_Id(display.getId()).stream()
          .filter(p -> p.isPrimary())
          .map(p -> p.getUrl())
          .findFirst().orElse(null);
      return DisplaySummaryResponse.builder()
          .id(display.getId())
          .title(display.getTitle())
          .city(display.getCity())
          .state(display.getState())
          .lat(display.getLocation().getY())
          .lng(display.getLocation().getX())
          .upvoteCount(display.getUpvoteCount())
          .photoCount(display.getPhotoCount())
          .displayType(display.getDisplayType().name())
          .primaryPhotoUrl(primaryPhotoUrl)
          .tags(display.getTags().stream().map(TagResponse::from).collect(Collectors.toList()))
          .build();
  }
  ```

  Also add this import at the top of the file:
  ```java
  import com.christmaslightmap.repository.UpvoteRepository;
  ```

- [ ] **Step 2: Add endpoints to DisplayController**

  Add these two methods to `DisplayController` (after the existing `removeUpvote` method):

  ```java
  @GetMapping("/mine")
  public ResponseEntity<ApiResponse<List<DisplaySummaryResponse>>> getMyDisplays(
      Authentication authentication
  ) {
      Long userId = (Long) authentication.getPrincipal();
      return ResponseEntity.ok(ApiResponse.success(displayService.getMyDisplays(userId)));
  }

  @GetMapping("/upvoted")
  public ResponseEntity<ApiResponse<List<DisplaySummaryResponse>>> getUpvotedDisplays(
      Authentication authentication
  ) {
      Long userId = (Long) authentication.getPrincipal();
      return ResponseEntity.ok(ApiResponse.success(displayService.getUpvotedDisplays(userId)));
  }
  ```

  Add to the imports if not present:
  ```java
  import java.util.List;
  ```

- [ ] **Step 3: Verify compilation**

  ```bash
  cd backend && ./mvnw compile -q
  ```

  Expected: no output (clean build).

- [ ] **Step 4: Run full test suite to confirm nothing broke**

  ```bash
  cd backend && ./mvnw test -q 2>&1 | tail -5
  ```

  Expected: `BUILD SUCCESS`

- [ ] **Step 5: Commit**

  ```bash
  git add backend/src/main/java/com/christmaslightmap/service/DisplayService.java \
           backend/src/main/java/com/christmaslightmap/controller/DisplayController.java
  git commit -m "feat: add GET /displays/mine and /displays/upvoted profile endpoints"
  ```

---

## Task 2: Angular Environment + Credentials Interceptor

**Files:**
- Create: `frontend/src/environments/environment.ts`
- Create: `frontend/src/environments/environment.development.ts`
- Modify: `frontend/angular.json`
- Create: `frontend/src/app/core/interceptors/credentials.interceptor.ts`
- Modify: `frontend/src/app/app.config.ts`

- [ ] **Step 1: Create environment files**

  Create `frontend/src/environments/environment.ts`:
  ```ts
  export const environment = {
    production: true,
    apiUrl: 'https://your-production-backend.com',
  };
  ```

  Create `frontend/src/environments/environment.development.ts`:
  ```ts
  export const environment = {
    production: false,
    apiUrl: 'http://localhost:8080',
  };
  ```

- [ ] **Step 2: Wire file replacements in angular.json**

  In `frontend/angular.json`, find the `"configurations"` block inside `"build"` → `"configurations"` → `"development"`. It currently is:
  ```json
  "development": {
    "optimization": false,
    "extractLicenses": false,
    "sourceMap": true
  }
  ```

  Replace it with:
  ```json
  "development": {
    "optimization": false,
    "extractLicenses": false,
    "sourceMap": true,
    "fileReplacements": [
      {
        "replace": "src/environments/environment.ts",
        "with": "src/environments/environment.development.ts"
      }
    ]
  }
  ```

- [ ] **Step 3: Create credentials interceptor**

  Create `frontend/src/app/core/interceptors/credentials.interceptor.ts`:
  ```ts
  import { HttpInterceptorFn } from '@angular/common/http';

  export const credentialsInterceptor: HttpInterceptorFn = (req, next) => {
    return next(req.clone({ withCredentials: true }));
  };
  ```

- [ ] **Step 4: Register interceptor in app.config.ts**

  Replace `frontend/src/app/app.config.ts` with:
  ```ts
  import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
  import { provideRouter } from '@angular/router';
  import { provideHttpClient, withInterceptors } from '@angular/common/http';
  import { routes } from './app.routes';
  import { credentialsInterceptor } from './core/interceptors/credentials.interceptor';

  export const appConfig: ApplicationConfig = {
    providers: [
      provideZoneChangeDetection({ eventCoalescing: true }),
      provideRouter(routes),
      provideHttpClient(withInterceptors([credentialsInterceptor])),
    ]
  };
  ```

- [ ] **Step 5: Verify the app compiles**

  ```bash
  cd frontend && npx tsc --noEmit 2>&1 | head -20
  ```

  Expected: no errors (or only pre-existing ones unrelated to these files).

- [ ] **Step 6: Commit**

  ```bash
  git add frontend/src/environments/ \
           frontend/angular.json \
           frontend/src/app/core/ \
           frontend/src/app/app.config.ts
  git commit -m "feat: add environment files, credentials interceptor, and HTTP client config"
  ```

---

## Task 3: Update Frontend Models (Camelcase Migration)

All interfaces must match backend DTO field names exactly. Backend uses Java camelCase (`upvoteCount`, `displayType`) and uppercase enum values (`DRIVE_BY`, `USER`).

**Files:**
- Modify: `frontend/src/app/models/display.model.ts`

- [ ] **Step 1: Replace display.model.ts**

  Replace the entire file contents with:

  ```ts
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
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  cd frontend && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -30
  ```

  Expected: errors for `display.display_type`, `display.upvote_count`, etc. in components — these are fixed in subsequent tasks. The models themselves should be error-free.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/app/models/display.model.ts
  git commit -m "feat: update frontend models to camelCase matching backend DTOs"
  ```

---

## Task 4: Update Templates (DisplayCard, DisplayDetail, Navbar)

Fix all component templates and TypeScript that reference the old snake_case property names.

**Files:**
- Modify: `frontend/src/app/shared/display-card/display-card.component.ts`
- Modify: `frontend/src/app/shared/display-detail/display-detail.component.ts`
- Modify: `frontend/src/app/shared/navbar/navbar.component.ts`

- [ ] **Step 1: Replace display-card.component.ts**

  Replace entire file:
  ```ts
  import { Component, Input, Output, EventEmitter } from '@angular/core';
  import { CommonModule } from '@angular/common';
  import { DisplaySummary, TYPE_COLORS, TYPE_LABELS } from '../../models/display.model';
  import { TagBadgeComponent } from '../tag-badge/tag-badge.component';
  import { UpvoteButtonComponent } from '../upvote-button/upvote-button.component';

  @Component({
    selector: 'app-display-card',
    standalone: true,
    imports: [CommonModule, TagBadgeComponent, UpvoteButtonComponent],
    template: `
      <div (click)="select.emit(display)"
           [style.border]="'1.5px solid ' + (isSelected ? 'var(--accent)' : '#e5e7eb')"
           [style.box-shadow]="isSelected ? '0 4px 20px var(--accent-shadow)' : '0 1px 4px rgba(0,0,0,0.05)'"
           style="background:white;border-radius:12px;overflow:hidden;cursor:pointer;
                  transition:all 0.15s;margin-bottom:10px;flex-shrink:0;">
        <!-- Photo -->
        <div style="width:100%;height:130px;background:#eef1f6;display:flex;align-items:center;
                    justify-content:center;position:relative;overflow:hidden;">
          <img *ngIf="display.primaryPhotoUrl" [src]="display.primaryPhotoUrl"
               style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0"/>
          <svg *ngIf="!display.primaryPhotoUrl" width="100%" height="100%"
               style="position:absolute;inset:0" preserveAspectRatio="none">
            <defs>
              <pattern [id]="'pat-'+display.id" patternUnits="userSpaceOnUse" width="24" height="24" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="24" stroke="#dde3ed" stroke-width="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" [attr.fill]="'url(#pat-' + display.id + ')'"/>
          </svg>
          <span *ngIf="!display.primaryPhotoUrl"
                style="position:relative;font-size:11px;color:#9aaabb;font-family:monospace;text-align:center;padding:0 12px;line-height:1.4">
            photo — {{display.title}}
          </span>
        </div>
        <div style="padding:11px 13px 13px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:3px">
            <div style="font-weight:700;font-size:13.5px;color:#111827;line-height:1.3;flex:1;margin-right:8px">{{display.title}}</div>
            <span [style.background]="typeColors.bg" [style.color]="typeColors.text"
                  style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;white-space:nowrap;flex-shrink:0">
              {{typeLabel}}
            </span>
          </div>
          <div style="font-size:12px;color:#9ca3af;margin-bottom:8px">📍 {{display.city}}, {{display.state}}</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">
            <app-tag-badge *ngFor="let t of display.tags.slice(0,3)" [tag]="t.name" [small]="true"/>
            <span *ngIf="display.tags.length > 3" style="font-size:10px;color:#9ca3af;align-self:center">+{{display.tags.length - 3}}</span>
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between">
            <app-upvote-button [count]="display.upvoteCount" [upvoted]="upvoted" size="sm"
              (toggled)="upvote.emit()"/>
            <button *ngIf="showDetails" (click)="viewDetails.emit(display); $event.stopPropagation()"
                    style="background:none;border:none;color:var(--accent-dark);font-size:12px;
                           font-weight:600;cursor:pointer;padding:4px 0">
              Details →
            </button>
          </div>
        </div>
      </div>
    `
  })
  export class DisplayCardComponent {
    @Input() display!: DisplaySummary;
    @Input() isSelected = false;
    @Input() upvoted = false;
    @Input() showDetails = true;

    @Output() select = new EventEmitter<DisplaySummary>();
    @Output() viewDetails = new EventEmitter<DisplaySummary>();
    @Output() upvote = new EventEmitter<void>();

    get typeColors() { return TYPE_COLORS[this.display.displayType] ?? TYPE_COLORS['DRIVE_BY']; }
    get typeLabel() { return TYPE_LABELS[this.display.displayType] ?? this.display.displayType; }
  }
  ```

- [ ] **Step 2: Replace display-detail.component.ts**

  The detail component now accepts a `DisplaySummary`, fetches the full `Display` internally, and shows a loading skeleton until the data arrives. Note that `DisplayApiService` is created in Task 6 — this step defines the interface it will satisfy; the file will compile once Task 6 is done.

  Replace entire file:
  ```ts
  import { Component, Input, Output, EventEmitter, OnInit, signal } from '@angular/core';
  import { CommonModule } from '@angular/common';
  import { DisplaySummary, Display, TYPE_COLORS, TYPE_LABELS } from '../../models/display.model';
  import { TagBadgeComponent } from '../tag-badge/tag-badge.component';
  import { UpvoteButtonComponent } from '../upvote-button/upvote-button.component';
  import { DisplayApiService } from '../../services/display-api.service';

  @Component({
    selector: 'app-display-detail',
    standalone: true,
    imports: [CommonModule, TagBadgeComponent, UpvoteButtonComponent],
    template: `
      <div (click)="close.emit()"
           style="position:fixed;inset:0;background:rgba(15,23,42,0.5);z-index:2000;
                  display:flex;align-items:flex-end;justify-content:center"
           [style.align-items]="isMobile ? 'flex-end' : 'center'">

        <div (click)="$event.stopPropagation()"
             [style.border-radius]="isMobile ? '20px 20px 0 0' : '20px'"
             [style.width]="isMobile ? '100%' : '520px'"
             [style.max-height]="isMobile ? '90vh' : '85vh'"
             style="background:white;overflow-y:auto;display:flex;flex-direction:column;
                    box-shadow:0 24px 64px rgba(0,0,0,0.2)">

          <!-- Loading state -->
          <div *ngIf="loading()" style="padding:60px;text-align:center;color:#94a3b8">
            Loading…
          </div>

          <ng-container *ngIf="!loading() && fullDisplay()">
            <!-- Photo area -->
            <div style="width:100%;height:220px;background:#eef1f6;flex-shrink:0;
                        display:flex;align-items:center;justify-content:center;
                        position:relative;overflow:hidden">
              <img *ngIf="fullDisplay()!.primaryPhotoUrl"
                   [src]="fullDisplay()!.primaryPhotoUrl!"
                   style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0"/>
              <svg *ngIf="!fullDisplay()!.primaryPhotoUrl" width="100%" height="100%"
                   style="position:absolute;inset:0" preserveAspectRatio="none">
                <defs>
                  <pattern id="det-pat" patternUnits="userSpaceOnUse" width="24" height="24" patternTransform="rotate(45)">
                    <line x1="0" y1="0" x2="0" y2="24" stroke="#dde3ed" stroke-width="1"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#det-pat)"/>
              </svg>
              <span *ngIf="!fullDisplay()!.primaryPhotoUrl"
                    style="position:relative;font-size:12px;color:#9aaabb;font-family:monospace">
                photo — {{fullDisplay()!.title}}
              </span>
              <button (click)="close.emit()"
                      style="position:absolute;top:12px;right:12px;width:32px;height:32px;
                             border-radius:50%;background:rgba(255,255,255,0.9);border:none;
                             cursor:pointer;display:flex;align-items:center;justify-content:center;
                             box-shadow:0 2px 8px rgba(0,0,0,0.15)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#374151" stroke-width="2.5">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <!-- Content -->
            <div style="padding:22px 24px 32px;display:flex;flex-direction:column;gap:16px">
              <!-- Header -->
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
                <div style="flex:1">
                  <div style="font-weight:800;font-size:20px;color:#0f172a;line-height:1.2;margin-bottom:4px">
                    {{fullDisplay()!.title}}
                  </div>
                  <div style="font-size:13px;color:#64748b">📍 {{fullDisplay()!.address}}</div>
                </div>
                <span [style.background]="typeColors.bg" [style.color]="typeColors.text"
                      style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:99px;
                             white-space:nowrap;flex-shrink:0;margin-top:2px">
                  {{typeLabel}}
                </span>
              </div>

              <!-- Upvote + stats -->
              <div style="display:flex;align-items:center;gap:16px;padding:14px 0;
                          border-top:1px solid #f1f5f9;border-bottom:1px solid #f1f5f9">
                <app-upvote-button [count]="fullDisplay()!.upvoteCount" [upvoted]="upvoted"
                  (toggled)="upvote.emit()"/>
                <div style="font-size:12.5px;color:#64748b">
                  {{fullDisplay()!.photoCount}} photos · {{fullDisplay()!.bestTime}}
                </div>
              </div>

              <!-- Tags -->
              <div style="display:flex;flex-wrap:wrap;gap:6px">
                <app-tag-badge *ngFor="let t of fullDisplay()!.tags" [tag]="t.name"/>
              </div>

              <!-- Description -->
              <p *ngIf="fullDisplay()!.description"
                 style="font-size:14px;color:#374151;line-height:1.65;margin:0">
                {{fullDisplay()!.description}}
              </p>

              <!-- Best time -->
              <div style="background:#f8fafc;border-radius:10px;padding:14px 16px">
                <div style="font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;
                            letter-spacing:0.6px;margin-bottom:6px">Hours</div>
                <div style="font-size:13.5px;color:#374151">{{fullDisplay()!.bestTime}}</div>
              </div>

              <!-- Action buttons -->
              <div style="display:flex;gap:10px;margin-top:4px">
                <button style="flex:1;padding:11px;border-radius:10px;font-size:13.5px;font-weight:600;
                               background:var(--accent);color:white;border:none;cursor:pointer">
                  Get Directions
                </button>
                <button (click)="report.emit()"
                        style="padding:11px 14px;border-radius:10px;font-size:13.5px;font-weight:600;
                               background:none;border:1.5px solid #e2e8f0;color:#64748b;cursor:pointer">
                  Report
                </button>
              </div>
            </div>
          </ng-container>
        </div>
      </div>
    `
  })
  export class DisplayDetailComponent implements OnInit {
    @Input() summary!: DisplaySummary;
    @Input() upvoted = false;
    @Input() isMobile = false;

    @Output() close = new EventEmitter<void>();
    @Output() upvote = new EventEmitter<void>();
    @Output() report = new EventEmitter<void>();

    loading = signal(true);
    fullDisplay = signal<Display | null>(null);

    constructor(private displayApi: DisplayApiService) {}

    ngOnInit() {
      this.displayApi.getById(this.summary.id).subscribe({
        next: display => {
          this.fullDisplay.set(display);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    }

    get typeColors() {
      return TYPE_COLORS[this.fullDisplay()?.displayType ?? ''] ?? TYPE_COLORS['DRIVE_BY'];
    }
    get typeLabel() {
      return TYPE_LABELS[this.fullDisplay()?.displayType ?? ''] ?? '';
    }
  }
  ```

- [ ] **Step 3: Update navbar.component.ts — compute initials from name**

  In `navbar.component.ts`, find line 45:
  ```html
  <app-avatar [initials]="user.avatar" [size]="32"/>
  ```
  Replace with:
  ```html
  <app-avatar [initials]="getInitials(user.name)" [size]="32"/>
  ```

  Then in the TypeScript class, add the import and method. Find the existing imports at the top and add:
  ```ts
  import { getInitials } from '../../models/display.model';
  ```

  In the class body, add:
  ```ts
  getInitials = getInitials;
  ```

- [ ] **Step 4: Check compile errors**

  ```bash
  cd frontend && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -40
  ```

  Remaining errors at this point will be in `auth.service.ts`, `upvote.service.ts`, `map.component.ts`, `profile.component.ts`, `admin.component.ts` — all fixed in later tasks. The three files changed here should be error-free.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/app/shared/display-card/display-card.component.ts \
           frontend/src/app/shared/display-detail/display-detail.component.ts \
           frontend/src/app/shared/navbar/navbar.component.ts
  git commit -m "feat: update display card, detail, and navbar to camelCase API types"
  ```

---

## Task 5: Rewrite AuthService + AppComponent Init + SignInModal OAuth

**Files:**
- Modify: `frontend/src/app/services/auth.service.ts`
- Modify: `frontend/src/app/app.component.ts`
- Modify: `frontend/src/app/shared/sign-in-modal/sign-in-modal.component.ts`

- [ ] **Step 1: Replace auth.service.ts**

  ```ts
  import { Injectable, signal, computed, inject } from '@angular/core';
  import { HttpClient } from '@angular/common/http';
  import { User } from '../models/display.model';
  import { environment } from '../../environments/environment';

  export type AccentColor = 'amber' | 'teal' | 'coral';

  export const ACCENT_MAP: Record<AccentColor, { accent: string; bg: string; dark: string; shadow: string }> = {
    amber: { accent: '#f59e0b', bg: '#fffbeb', dark: '#b45309', shadow: 'rgba(245,158,11,0.18)' },
    teal:  { accent: '#0d9488', bg: '#f0fdfa', dark: '#0f766e', shadow: 'rgba(13,148,136,0.18)' },
    coral: { accent: '#f97316', bg: '#fff7ed', dark: '#c2410c', shadow: 'rgba(249,115,22,0.18)' },
  };

  @Injectable({ providedIn: 'root' })
  export class AuthService {
    private http = inject(HttpClient);

    readonly currentUser = signal<User | null>(null);
    readonly accentColor = signal<AccentColor>('teal');
    readonly mapTiles = signal<'light' | 'dark' | 'standard'>('light');

    readonly isLoggedIn = computed(() => !!this.currentUser());
    readonly isAdmin = computed(() => this.currentUser()?.role === 'ADMIN');

    init(): void {
      this.http.get<{ success: boolean; data: User }>(`${environment.apiUrl}/api/v1/auth/me`)
        .subscribe({
          next: res => this.currentUser.set(res.data),
          error: () => this.currentUser.set(null),
        });
    }

    login(): void {
      window.location.href = `${environment.apiUrl}/oauth2/authorization/google`;
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
  ```

- [ ] **Step 2: Update app.component.ts — init on load, real sign-in**

  In `app.component.ts`, find the class declaration:
  ```ts
  export class AppComponent {
  ```
  And find the constructor:
  ```ts
  constructor(
    public authService: AuthService,
    public upvoteService: UpvoteService,
  ) {}
  ```

  Replace the constructor and add `OnInit`:

  First, add `OnInit` to the Angular imports. Find:
  ```ts
  import { Component, signal, computed, effect, HostListener } from '@angular/core';
  ```
  Replace with:
  ```ts
  import { Component, OnInit, signal, computed, effect, HostListener } from '@angular/core';
  ```

  Then change the class declaration from:
  ```ts
  export class AppComponent {
  ```
  to:
  ```ts
  export class AppComponent implements OnInit {
  ```

  Replace the constructor:
  ```ts
  constructor(
    public authService: AuthService,
    public upvoteService: UpvoteService,
  ) {}
  ```
  with:
  ```ts
  constructor(
    public authService: AuthService,
    public upvoteService: UpvoteService,
  ) {}

  ngOnInit() {
    this.authService.init();
  }
  ```

  Find the `mockSignIn()` method:
  ```ts
  mockSignIn() {
    this.authService.mockSignIn();
    this.showSignIn.set(false);
  }
  ```
  Replace with:
  ```ts
  signIn() {
    this.showSignIn.set(false);
    this.authService.login();
  }
  ```

  Find the template binding `(signIn)="mockSignIn()"`:
  ```html
  <app-sign-in-modal *ngIf="showSignIn()"
    (close)="showSignIn.set(false)"
    (signIn)="mockSignIn()"/>
  ```
  Replace with:
  ```html
  <app-sign-in-modal *ngIf="showSignIn()"
    (close)="showSignIn.set(false)"
    (signIn)="signIn()"/>
  ```

  Find the `onAuthAction()` method:
  ```ts
  onAuthAction() {
    if (this.authService.currentUser()) {
      this.authService.signOut();
    } else {
      this.showSignIn.set(true);
    }
  }
  ```
  Replace with:
  ```ts
  onAuthAction() {
    if (this.authService.currentUser()) {
      this.authService.logout();
    } else {
      this.showSignIn.set(true);
    }
  }
  ```

  Also update `selectedDisplay` type. Find:
  ```ts
  selectedDisplay = signal<Display | null>(null);
  ```
  Replace with:
  ```ts
  selectedDisplay = signal<import('./models/display.model').DisplaySummary | null>(null);
  ```

  And update `openDetail`:
  ```ts
  openDetail(display: Display) {
    this.selectedDisplay.set(display);
  }
  ```
  Replace with:
  ```ts
  openDetail(display: import('./models/display.model').DisplaySummary) {
    this.selectedDisplay.set(display);
  }
  ```

  Update the `DisplayDetailComponent` binding in the template. Find:
  ```html
  <app-display-detail *ngIf="selectedDisplay()"
    [display]="selectedDisplay()!"
    [upvoted]="isUpvoted(selectedDisplay()!.id)"
    [isMobile]="isMobile"
    (close)="selectedDisplay.set(null)"
    (upvote)="upvoteService.toggle(selectedDisplay()!.id)"
    (report)="selectedDisplay.set(null)"/>
  ```
  Replace with:
  ```html
  <app-display-detail *ngIf="selectedDisplay()"
    [summary]="selectedDisplay()!"
    [upvoted]="isUpvoted(selectedDisplay()!.id)"
    [isMobile]="isMobile"
    (close)="selectedDisplay.set(null)"
    (upvote)="upvoteService.toggle(selectedDisplay()!.id)"
    (report)="selectedDisplay.set(null)"/>
  ```

- [ ] **Step 3: Update sign-in-modal — wire Google button to OAuth, remove Facebook**

  Replace the two `(click)="signIn.emit()"` buttons (Google and Facebook) with a single Google button that emits `signIn`:
  ```html
  <button (click)="signIn.emit()"
          style="display:flex;align-items:center;gap:12px;padding:11px 18px;
                 border:1.5px solid #e2e8f0;border-radius:10px;background:white;
                 cursor:pointer;font-size:14px;font-weight:600;color:#0f172a;
                 transition:background 0.1s;width:100%"
          (mouseenter)="$any($event.target).style.background='#f8fafc'"
          (mouseleave)="$any($event.target).style.background='white'">
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
    Continue with Google
  </button>
  ```

  The `signIn` event is emitted to `AppComponent` which calls `authService.login()` which does the full-page redirect.

- [ ] **Step 4: Compile check**

  ```bash
  cd frontend && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -40
  ```

  Remaining errors will be in `display-detail.component.ts` (missing `DisplayApiService`) and the pages. Everything touched in this task should be clean.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/app/services/auth.service.ts \
           frontend/src/app/app.component.ts \
           frontend/src/app/shared/sign-in-modal/sign-in-modal.component.ts
  git commit -m "feat: wire AuthService to real OAuth + /auth/me endpoint, AppComponent init"
  ```

---

## Task 6: Create DisplayApiService + Rewrite UpvoteService

**Files:**
- Create: `frontend/src/app/services/display-api.service.ts`
- Modify: `frontend/src/app/services/upvote.service.ts`

- [ ] **Step 1: Create display-api.service.ts**

  Create `frontend/src/app/services/display-api.service.ts`:
  ```ts
  import { Injectable, inject } from '@angular/core';
  import { HttpClient, HttpParams } from '@angular/common/http';
  import { Observable } from 'rxjs';
  import { map } from 'rxjs/operators';
  import {
    Display, DisplaySummary, Tag, Report,
    PagedResponse, SearchParams, CreateDisplayRequest
  } from '../models/display.model';
  import { environment } from '../../environments/environment';

  interface ApiResponse<T> { success: boolean; data: T; }

  @Injectable({ providedIn: 'root' })
  export class DisplayApiService {
    private http = inject(HttpClient);
    private base = `${environment.apiUrl}/api/v1`;

    search(params: SearchParams): Observable<PagedResponse<DisplaySummary>> {
      let p = new HttpParams()
        .set('lat', params.lat)
        .set('lng', params.lng)
        .set('radiusMiles', params.radiusMiles ?? 10)
        .set('page', params.page ?? 0)
        .set('size', params.size ?? 50);
      if (params.displayType) p = p.set('displayType', params.displayType);
      if (params.tags?.length) p = p.set('tags', params.tags.join(','));
      return this.http.get<ApiResponse<PagedResponse<DisplaySummary>>>(`${this.base}/displays/search`, { params: p })
        .pipe(map(r => r.data));
    }

    getById(id: number): Observable<Display> {
      return this.http.get<ApiResponse<Display>>(`${this.base}/displays/${id}`)
        .pipe(map(r => r.data));
    }

    create(request: CreateDisplayRequest): Observable<Display> {
      return this.http.post<ApiResponse<Display>>(`${this.base}/displays`, request)
        .pipe(map(r => r.data));
    }

    uploadPhoto(displayId: number, file: File): Observable<{ id: number; url: string; isPrimary: boolean }> {
      const fd = new FormData();
      fd.append('file', file);
      return this.http.post<ApiResponse<{ id: number; url: string; isPrimary: boolean }>>(`${this.base}/displays/${displayId}/photos`, fd)
        .pipe(map(r => r.data));
    }

    upvote(displayId: number): Observable<void> {
      return this.http.post<void>(`${this.base}/displays/${displayId}/upvote`, {});
    }

    removeUpvote(displayId: number): Observable<void> {
      return this.http.delete<void>(`${this.base}/displays/${displayId}/upvote`);
    }

    report(displayId: number, reason: string, notes: string): Observable<void> {
      return this.http.post<void>(`${this.base}/displays/${displayId}/report`, { reason, notes });
    }

    getTags(): Observable<Tag[]> {
      return this.http.get<ApiResponse<Tag[]>>(`${this.base}/tags`)
        .pipe(map(r => r.data));
    }

    getMyDisplays(): Observable<DisplaySummary[]> {
      return this.http.get<ApiResponse<DisplaySummary[]>>(`${this.base}/displays/mine`)
        .pipe(map(r => r.data));
    }

    getUpvotedDisplays(): Observable<DisplaySummary[]> {
      return this.http.get<ApiResponse<DisplaySummary[]>>(`${this.base}/displays/upvoted`)
        .pipe(map(r => r.data));
    }

    getReports(status?: string, page = 0, size = 20): Observable<PagedResponse<Report>> {
      let p = new HttpParams().set('page', page).set('size', size);
      if (status && status !== 'ALL') p = p.set('status', status);
      return this.http.get<ApiResponse<PagedResponse<Report>>>(`${this.base}/admin/reports`, { params: p })
        .pipe(map(r => r.data));
    }

    updateReport(reportId: number, status: string): Observable<Report> {
      return this.http.patch<ApiResponse<Report>>(`${this.base}/admin/reports/${reportId}`, { status })
        .pipe(map(r => r.data));
    }
  }
  ```

- [ ] **Step 2: Replace upvote.service.ts**

  ```ts
  import { Injectable, signal, inject } from '@angular/core';
  import { DisplayApiService } from './display-api.service';

  @Injectable({ providedIn: 'root' })
  export class UpvoteService {
    private displayApi = inject(DisplayApiService);
    readonly upvotedIds = signal<Set<number>>(new Set());

    isUpvoted(id: number): boolean {
      return this.upvotedIds().has(id);
    }

    initFromIds(ids: number[]): void {
      this.upvotedIds.set(new Set(ids));
    }

    toggle(id: number): void {
      const wasUpvoted = this.upvotedIds().has(id);
      const next = new Set(this.upvotedIds());
      if (wasUpvoted) {
        next.delete(id);
        this.upvotedIds.set(next);
        this.displayApi.removeUpvote(id).subscribe({
          error: () => {
            const rollback = new Set(this.upvotedIds());
            rollback.add(id);
            this.upvotedIds.set(rollback);
          }
        });
      } else {
        next.add(id);
        this.upvotedIds.set(next);
        this.displayApi.upvote(id).subscribe({
          error: () => {
            const rollback = new Set(this.upvotedIds());
            rollback.delete(id);
            this.upvotedIds.set(rollback);
          }
        });
      }
    }

    getUpvotedIds(): Set<number> {
      return this.upvotedIds();
    }
  }
  ```

- [ ] **Step 3: Load upvoted IDs after auth init**

  In `auth.service.ts`, inject `UpvoteService` and seed it after successful auth. Find the `init()` method:
  ```ts
  init(): void {
    this.http.get<{ success: boolean; data: User }>(`${environment.apiUrl}/api/v1/auth/me`)
      .subscribe({
        next: res => this.currentUser.set(res.data),
        error: () => this.currentUser.set(null),
      });
  }
  ```
  Replace with:
  ```ts
  init(): void {
    this.http.get<{ success: boolean; data: User }>(`${environment.apiUrl}/api/v1/auth/me`)
      .subscribe({
        next: res => {
          this.currentUser.set(res.data);
          // Seed upvote state from server so upvoted indicators are accurate on load
          this.http.get<{ success: boolean; data: Array<{ id: number }> }>(`${environment.apiUrl}/api/v1/displays/upvoted`)
            .subscribe({ next: r => this.upvoteService.initFromIds(r.data.map(d => d.id)) });
        },
        error: () => this.currentUser.set(null),
      });
  }
  ```
  Add field to `AuthService` class:
  ```ts
  private upvoteService = inject(UpvoteService);
  ```
  Add import at the top of `auth.service.ts`:
  ```ts
  import { UpvoteService } from './upvote.service';
  ```

  **Important:** Angular will detect a circular dependency if `UpvoteService` injects `DisplayApiService` and `DisplayApiService` is also used elsewhere, but there is no circular dependency here — `AuthService` → `UpvoteService` → `DisplayApiService` is a one-way chain.

- [ ] **Step 4: Compile check**

  ```bash
  cd frontend && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -40
  ```

  After this task, `display-detail.component.ts` should compile (it imports `DisplayApiService`). Remaining errors will be in the page components (map, profile, admin, submit).

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/app/services/display-api.service.ts \
           frontend/src/app/services/upvote.service.ts \
           frontend/src/app/services/auth.service.ts
  git commit -m "feat: add DisplayApiService with all HTTP methods, rewrite UpvoteService with optimistic UI"
  ```

---

## Task 7: Wire MapComponent to Search API

Replace `SAMPLE_DISPLAYS` with real search calls triggered on map pan/zoom.

**Files:**
- Modify: `frontend/src/app/pages/map/map.component.ts`

- [ ] **Step 1: Replace the map component class and template section that use mock data**

  This is a large file. Make the following targeted changes:

  **a) Update imports at the top** — replace the current imports block:
  ```ts
  import { Display, SAMPLE_DISPLAYS, TYPE_COLORS, TYPE_LABELS } from '../../models/display.model';
  ```
  with:
  ```ts
  import { DisplaySummary, Tag, TYPE_COLORS } from '../../models/display.model';
  import { DisplayApiService } from '../../services/display-api.service';
  ```

  Also update the `User` import line. Find:
  ```ts
  import { User, ALL_TAGS } from '../../models/display.model';
  ```
  Replace with:
  ```ts
  import { User } from '../../models/display.model';
  ```

  **b) Update class fields** — find the class property declarations block:
  ```ts
  isMobile = window.innerWidth < 768;
  selected: Display | null = null;
  activeType = 'all';
  activeTags: string[] = [];
  sortBy = 'popular';
  tagsOpen = false;
  snapKey: 'peek' | 'half' | 'full' = 'peek';
  snaps = SNAPS;
  snapKeys = Object.keys(SNAPS) as ('peek' | 'half' | 'full')[];
  allTags = ALL_TAGS;
  showTour = false;
  welcomeDismissed = localStorage.getItem('luminary_welcome_dismissed') === '1';
  ```
  Replace with:
  ```ts
  isMobile = window.innerWidth < 768;
  selected: DisplaySummary | null = null;
  activeType = 'all';
  activeTags: string[] = [];
  sortBy = 'popular';
  tagsOpen = false;
  snapKey: 'peek' | 'half' | 'full' = 'peek';
  snaps = SNAPS;
  snapKeys = Object.keys(SNAPS) as ('peek' | 'half' | 'full')[];
  allTags: string[] = [];
  availableTags: Tag[] = [];
  displays: DisplaySummary[] = [];
  loading = false;
  showTour = false;
  welcomeDismissed = localStorage.getItem('luminary_welcome_dismissed') === '1';
  ```

  **c) Add constructor with DI** — find `private map: L.Map | null = null;` and add a constructor above it:
  ```ts
  constructor(private displayApi: DisplayApiService) {}
  ```

  **d) Replace the `filtered` getter** — find:
  ```ts
  get filtered(): Display[] {
    return SAMPLE_DISPLAYS.filter(d => {
      if (this.activeType !== 'all' && d.display_type !== this.activeType) return false;
      if (this.activeTags.length && !this.activeTags.every(t => d.tags.includes(t))) return false;
      return true;
    }).sort((a, b) => this.sortBy === 'popular' ? b.upvote_count - a.upvote_count : b.id - a.id);
  }
  ```
  Replace with:
  ```ts
  get filtered(): DisplaySummary[] {
    return this.displays.filter(d => {
      if (this.activeType !== 'all' && d.displayType !== this.activeType) return false;
      if (this.activeTags.length && !this.activeTags.every(t => d.tags.some(tag => tag.name === t))) return false;
      return true;
    }).sort((a, b) => this.sortBy === 'popular' ? b.upvoteCount - a.upvoteCount : b.id - a.id);
  }
  ```

  **e) Update ngAfterViewInit** — find:
  ```ts
  ngAfterViewInit() {
    setTimeout(() => this.initMap(), 100);
    window.addEventListener('resize', this.onResize.bind(this));
  }
  ```
  Replace with:
  ```ts
  ngAfterViewInit() {
    setTimeout(() => this.initMap(), 100);
    window.addEventListener('resize', this.onResize.bind(this));
    this.displayApi.getTags().subscribe(tags => {
      this.availableTags = tags;
      this.allTags = tags.map(t => t.name);
    });
  }
  ```

  **f) Add a `loadDisplays()` method** — add this new method before `selectDisplay()`:
  ```ts
  loadDisplays() {
    if (!this.map) return;
    const center = this.map.getCenter();
    const tagIds = this.activeTags.map(name => this.availableTags.find(t => t.name === name)?.id).filter((id): id is number => !!id);
    this.loading = true;
    this.displayApi.search({
      lat: center.lat,
      lng: center.lng,
      radiusMiles: 10,
      displayType: this.activeType !== 'all' ? this.activeType : undefined,
      tags: tagIds.length ? tagIds : undefined,
    }).subscribe({
      next: page => {
        this.displays = page.content;
        this.loading = false;
        this.renderMarkers();
      },
      error: () => { this.loading = false; },
    });
  }
  ```

  **g) Wire map idle event to load** — in `initMap()`, find:
  ```ts
  this.map.on('click', () => { this.selected = null; });
  this.map.invalidateSize();
  ```
  Replace with:
  ```ts
  this.map.on('click', () => { this.selected = null; });
  this.map.on('moveend', () => this.loadDisplays());
  this.map.invalidateSize();
  this.loadDisplays();
  ```

  **h) Update renderMarkers()** — find:
  ```ts
  private renderMarkers() {
    this.markers.forEach(m => this.map!.removeLayer(m));
    this.markers = [];
    SAMPLE_DISPLAYS.forEach(display => {
      const tc = TYPE_COLORS[display.display_type];
      const label = display.upvote_count >= 1000
        ? (display.upvote_count / 1000).toFixed(1) + 'k' : String(display.upvote_count);
  ```
  Replace with:
  ```ts
  private renderMarkers() {
    this.markers.forEach(m => this.map!.removeLayer(m));
    this.markers = [];
    this.displays.forEach(display => {
      const tc = TYPE_COLORS[display.displayType] ?? TYPE_COLORS['DRIVE_BY'];
      const label = display.upvoteCount >= 1000
        ? (display.upvoteCount / 1000).toFixed(1) + 'k' : String(display.upvoteCount);
  ```

  **i) Update map popups** — in the template, find two instances of `selected.address` and replace both with `selected.city + ', ' + selected.state`:
  ```html
  <div style="font-size:12px;color:#94a3b8;margin-bottom:8px">📍 {{selected.address}}</div>
  ```
  Replace each with:
  ```html
  <div style="font-size:12px;color:#94a3b8;margin-bottom:8px">📍 {{selected.city}}, {{selected.state}}</div>
  ```

  Also update the two instances of `selected.upvote_count` in the template:
  ```html
  [count]="selected.upvote_count"
  ```
  Replace with:
  ```html
  [count]="selected.upvoteCount"
  ```

  And update the two tag badge usages in the map popup:
  ```html
  <app-tag-badge *ngFor="let t of selected.tags.slice(0,3)" [tag]="t" [small]="true"/>
  ```
  Replace with:
  ```html
  <app-tag-badge *ngFor="let t of selected.tags.slice(0,3)" [tag]="t.name" [small]="true"/>
  ```

  **j) Update clearFilters to trigger reload**:
  ```ts
  clearFilters() {
    this.activeTags = [];
    this.activeType = 'all';
    this.loadDisplays();
  }
  ```

  **k) Update toggleTag to trigger reload**:
  ```ts
  toggleTag(tag: string) {
    if (this.activeTags.includes(tag)) {
      this.activeTags = this.activeTags.filter(t => t !== tag);
    } else {
      this.activeTags = [...this.activeTags, tag];
    }
    this.loadDisplays();
  }
  ```

  Also update the type filter buttons in the template to use backend enum values. Find the `typeFilters` array in the class:
  ```ts
  typeFilters = [
    { id: 'all', label: 'All' },
    { id: 'drive-by', label: 'Drive-by' },
    { id: 'walk-through', label: 'Walk-through' },
    { id: 'both', label: 'Combined' },
  ];
  ```
  Replace with:
  ```ts
  typeFilters = [
    { id: 'all', label: 'All' },
    { id: 'DRIVE_BY', label: 'Drive-by' },
    { id: 'WALK_THROUGH', label: 'Walk-through' },
    { id: 'BOTH', label: 'Combined' },
  ];
  ```

  And add a type filter change handler. The template already has `(click)="activeType = t.id"` — change it to `(click)="setTypeFilter(t.id)"` in both the mobile and desktop filter templates.

  Add the method:
  ```ts
  setTypeFilter(type: string) {
    this.activeType = type;
    this.loadDisplays();
  }
  ```

  Also update the `Output` upvoteToggle handler:
  ```ts
  handleUpvote(id: number) {
    if (!this.user) { this.needAuth.emit(); return; }
    this.upvoteToggle.emit(id);
  }
  ```
  This is fine as-is — AppComponent handles the actual toggle.

- [ ] **Step 2: Compile check**

  ```bash
  cd frontend && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -40
  ```

  Map component errors should be resolved. Remaining errors will be in profile, admin, and submit pages.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/app/pages/map/map.component.ts
  git commit -m "feat: wire MapComponent to real display search API with Leaflet map pan trigger"
  ```

---

## Task 8: Wire SubmitComponent

Add geocoding and POST to create display API.

**Files:**
- Modify: `frontend/src/app/pages/submit/submit.component.ts`

- [ ] **Step 1: Update submit.component.ts imports and form**

  Find the current imports:
  ```ts
  import { User, ALL_TAGS, TYPE_LABELS } from '../../models/display.model';
  ```
  Replace with:
  ```ts
  import { ALL_TAGS, TYPE_LABELS, Tag } from '../../models/display.model';
  import { DisplayApiService } from '../../services/display-api.service';
  ```

  Remove `const TYPES = Object.entries(TYPE_LABELS) as [string, string][];` and replace with:
  ```ts
  const TYPES: [string, string][] = [
    ['DRIVE_BY', 'Drive-by'],
    ['WALK_THROUGH', 'Walk-through'],
    ['BOTH', 'Drive-by & Walk-through'],
  ];
  ```

- [ ] **Step 2: Update the class body**

  Replace the class body (the part from `export class SubmitComponent` to the closing `}`):
  ```ts
  export class SubmitComponent {
    @Input() user: any = null;
    @Output() goHome = new EventEmitter<void>();

    step = signal<'location' | 'details' | 'photo' | 'done'>('location');
    steps = ['location', 'details', 'photo'];
    types = TYPES;
    allTags: string[] = ALL_TAGS;
    availableTags: Tag[] = [];
    photoFile: File | null = null;
    photoPreview: string | null = null;
    submitting = false;
    error: string | null = null;

    form = {
      address: '', city: '', state: '', postcode: '',
      title: '', displayType: 'DRIVE_BY', tags: [] as string[],
      description: '', bestTime: '',
      lat: 0, lng: 0,
    };

    constructor(private displayApi: DisplayApiService) {
      this.displayApi.getTags().subscribe(tags => {
        this.availableTags = tags;
      });
    }

    getStepIndex() {
      return this.steps.indexOf(this.step() as any);
    }

    toggleTag(tag: string) {
      const idx = this.form.tags.indexOf(tag);
      if (idx > -1) this.form.tags.splice(idx, 1);
      else this.form.tags.push(tag);
    }

    canAdvance() {
      if (this.step() === 'location') return this.form.address.trim() && this.form.city.trim();
      if (this.step() === 'details') return this.form.title.trim() && this.form.displayType;
      return true;
    }

    prevStep() {
      if (this.step() === 'details') this.step.set('location');
      else if (this.step() === 'photo') this.step.set('details');
    }

    nextStep() {
      if (this.step() === 'location') {
        this.geocodeAndAdvance();
      } else if (this.step() === 'details') {
        this.step.set('photo');
      } else if (this.step() === 'photo') {
        this.submitDisplay();
      }
    }

    private geocodeAndAdvance() {
      const query = encodeURIComponent(`${this.form.address}, ${this.form.city}, ${this.form.state}`);
      fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`)
        .then(r => r.json())
        .then((results: any[]) => {
          if (results.length > 0) {
            this.form.lat = parseFloat(results[0].lat);
            this.form.lng = parseFloat(results[0].lon);
          }
          this.step.set('details');
        })
        .catch(() => this.step.set('details'));
    }

    private submitDisplay() {
      this.submitting = true;
      this.error = null;
      const tagIds = this.form.tags
        .map(name => this.availableTags.find(t => t.name === name)?.id)
        .filter((id): id is number => !!id);

      this.displayApi.create({
        title: this.form.title,
        description: this.form.description,
        address: this.form.address,
        city: this.form.city,
        state: this.form.state,
        postcode: this.form.postcode,
        lat: this.form.lat,
        lng: this.form.lng,
        bestTime: this.form.bestTime,
        displayType: this.form.displayType,
        tagIds,
      }).subscribe({
        next: display => {
          if (this.photoFile) {
            this.displayApi.uploadPhoto(display.id, this.photoFile).subscribe({
              complete: () => { this.submitting = false; this.step.set('done'); },
              error: () => { this.submitting = false; this.step.set('done'); },
            });
          } else {
            this.submitting = false;
            this.step.set('done');
          }
        },
        error: () => {
          this.submitting = false;
          this.error = 'Submission failed. Please try again.';
        },
      });
    }

    onFileChange(event: Event) {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) { this.photoFile = file; this.readFile(file); }
    }

    onDrop(event: DragEvent) {
      event.preventDefault();
      const file = event.dataTransfer?.files?.[0];
      if (file) { this.photoFile = file; this.readFile(file); }
    }

    private readFile(file: File) {
      const reader = new FileReader();
      reader.onload = e => this.photoPreview = e.target?.result as string;
      reader.readAsDataURL(file);
    }
  }
  ```

- [ ] **Step 3: Add postcode field to the template**

  In the Step 1 (location) section of the template, find the `state` input field block:
  ```html
  <div style="flex:1">
    <label style="...">State *</label>
    <input [(ngModel)]="form.state" .../>
  </div>
  ```

  After this div (still within the `display:flex;gap:12px` container), add a postcode field:
  ```html
  <div style="flex:1">
    <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">ZIP</label>
    <input [(ngModel)]="form.postcode" placeholder="80205"
           style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
                  font-size:14px;color:#0f172a;background:white;box-sizing:border-box;outline:none"
           (focus)="$any($event.target).style.borderColor='var(--accent)'"
           (blur)="$any($event.target).style.borderColor='#e2e8f0'"/>
  </div>
  ```

  Also add a "Best Time" field in the Step 2 (details) section. After the `Description` textarea, add:
  ```html
  <div>
    <label style="font-size:13px;font-weight:600;color:#374151;display:block;margin-bottom:6px">Best Viewing Time</label>
    <input [(ngModel)]="form.bestTime" placeholder="Nightly 5pm–11pm"
           style="width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;
                  font-size:14px;color:#0f172a;background:white;box-sizing:border-box;outline:none"
           (focus)="$any($event.target).style.borderColor='var(--accent)'"
           (blur)="$any($event.target).style.borderColor='#e2e8f0'"/>
  </div>
  ```

  Also update the Submit button to show submitting state. Find:
  ```html
  {{step() === 'photo' ? 'Submit Display' : 'Continue'}}
  ```
  Replace with:
  ```html
  {{step() === 'photo' ? (submitting ? 'Submitting…' : 'Submit Display') : 'Continue'}}
  ```

  Add error display just above the navigation buttons:
  ```html
  <div *ngIf="error" style="color:#dc2626;font-size:13px;padding:8px 0">{{error}}</div>
  ```

- [ ] **Step 4: Compile check**

  ```bash
  cd frontend && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -40
  ```

  Submit component should be error-free. Remaining errors in profile and admin.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/src/app/pages/submit/submit.component.ts
  git commit -m "feat: wire SubmitComponent to create display API with Nominatim geocoding"
  ```

---

## Task 9: Wire ProfileComponent

**Files:**
- Modify: `frontend/src/app/pages/profile/profile.component.ts`

- [ ] **Step 1: Replace profile.component.ts**

  ```ts
  import { Component, Input, Output, EventEmitter, signal, OnInit } from '@angular/core';
  import { CommonModule } from '@angular/common';
  import { DisplaySummary, User, getInitials } from '../../models/display.model';
  import { DisplayCardComponent } from '../../shared/display-card/display-card.component';
  import { AvatarComponent } from '../../shared/avatar/avatar.component';
  import { UpvoteService } from '../../services/upvote.service';
  import { DisplayApiService } from '../../services/display-api.service';

  @Component({
    selector: 'app-profile',
    standalone: true,
    imports: [CommonModule, DisplayCardComponent, AvatarComponent],
    template: `
      <div style="height:100%;overflow-y:auto;background:#f8fafc;padding-bottom:40px">
        <div style="max-width:600px;margin:0 auto;padding:28px 20px 0">

          <!-- Profile card -->
          <div style="background:white;border-radius:16px;padding:24px;margin-bottom:20px;
                      box-shadow:0 1px 6px rgba(0,0,0,0.06)">
            <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
              <app-avatar [initials]="user ? getInitials(user.name) : '?'" [size]="60"/>
              <div>
                <div style="font-weight:800;font-size:19px;color:#0f172a">{{user?.name || 'Guest'}}</div>
                <div style="font-size:13px;color:#64748b;margin-top:2px">{{user?.email || ''}}</div>
              </div>
            </div>
            <div style="display:flex;gap:24px">
              <div style="text-align:center">
                <div style="font-weight:800;font-size:22px;color:#0f172a">{{myDisplays().length}}</div>
                <div style="font-size:12px;color:#64748b;margin-top:2px">Displays</div>
              </div>
              <div style="text-align:center">
                <div style="font-weight:800;font-size:22px;color:#0f172a">{{totalUpvotes()}}</div>
                <div style="font-size:12px;color:#64748b;margin-top:2px">Upvotes received</div>
              </div>
              <div style="text-align:center">
                <div style="font-weight:800;font-size:22px;color:#0f172a">{{upvotedDisplays().length}}</div>
                <div style="font-size:12px;color:#64748b;margin-top:2px">Upvoted</div>
              </div>
            </div>
          </div>

          <!-- Tabs -->
          <div style="display:flex;background:white;border-radius:12px;padding:4px;margin-bottom:16px;
                      box-shadow:0 1px 6px rgba(0,0,0,0.06)">
            <button *ngFor="let t of tabs" (click)="setTab(t.id)"
                    [style.background]="activeTab() === t.id ? 'var(--accent)' : 'none'"
                    [style.color]="activeTab() === t.id ? 'white' : '#64748b'"
                    style="flex:1;border:none;padding:9px;border-radius:9px;font-size:13.5px;
                           font-weight:600;cursor:pointer;transition:all 0.15s">
              {{t.label}}
            </button>
          </div>

          <!-- Loading -->
          <div *ngIf="loadingMine() || loadingUpvoted()"
               style="text-align:center;padding:48px 0;color:#94a3b8;font-size:14px">
            Loading…
          </div>

          <!-- My Displays -->
          <div *ngIf="activeTab() === 'mine' && !loadingMine()">
            <div *ngIf="myDisplays().length === 0"
                 style="text-align:center;padding:48px 0;color:#94a3b8">
              <div style="font-size:14px">You haven't submitted any displays yet</div>
            </div>
            <app-display-card *ngFor="let d of myDisplays()" [display]="d"
              [upvoted]="upvoteService.isUpvoted(d.id)" [showDetails]="true"
              (select)="selectDisplay.emit(d)" (upvote)="upvoteService.toggle(d.id)"
              (viewDetails)="selectDisplay.emit(d)"/>
          </div>

          <!-- Upvoted -->
          <div *ngIf="activeTab() === 'upvoted' && !loadingUpvoted()">
            <div *ngIf="upvotedDisplays().length === 0"
                 style="text-align:center;padding:48px 0;color:#94a3b8">
              <div style="font-size:14px">No upvoted displays yet</div>
            </div>
            <app-display-card *ngFor="let d of upvotedDisplays()" [display]="d"
              [upvoted]="true" [showDetails]="true"
              (select)="selectDisplay.emit(d)" (upvote)="upvoteService.toggle(d.id)"
              (viewDetails)="selectDisplay.emit(d)"/>
          </div>

        </div>
      </div>
    `
  })
  export class ProfileComponent implements OnInit {
    @Input() user: User | null = null;
    @Output() selectDisplay = new EventEmitter<DisplaySummary>();

    activeTab = signal<'mine' | 'upvoted'>('mine');
    myDisplays = signal<DisplaySummary[]>([]);
    upvotedDisplays = signal<DisplaySummary[]>([]);
    loadingMine = signal(true);
    loadingUpvoted = signal(true);

    tabs = [
      { id: 'mine', label: 'My Displays' },
      { id: 'upvoted', label: 'Upvoted' },
    ];

    getInitials = getInitials;

    constructor(
      public upvoteService: UpvoteService,
      private displayApi: DisplayApiService,
    ) {}

    ngOnInit() {
      this.displayApi.getMyDisplays().subscribe({
        next: d => { this.myDisplays.set(d); this.loadingMine.set(false); },
        error: () => this.loadingMine.set(false),
      });
      this.displayApi.getUpvotedDisplays().subscribe({
        next: d => { this.upvotedDisplays.set(d); this.loadingUpvoted.set(false); },
        error: () => this.loadingUpvoted.set(false),
      });
    }

    setTab(id: string) {
      this.activeTab.set(id as 'mine' | 'upvoted');
    }

    totalUpvotes() {
      return this.myDisplays().reduce((sum, d) => sum + d.upvoteCount, 0);
    }
  }
  ```

- [ ] **Step 2: Compile check**

  ```bash
  cd frontend && npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -40
  ```

  Only admin.component.ts should have errors now.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/app/pages/profile/profile.component.ts
  git commit -m "feat: wire ProfileComponent to getMyDisplays and getUpvotedDisplays API"
  ```

---

## Task 10: Wire AdminComponent

**Files:**
- Modify: `frontend/src/app/pages/admin/admin.component.ts`

- [ ] **Step 1: Replace admin.component.ts**

  ```ts
  import { Component, signal, computed, OnInit } from '@angular/core';
  import { CommonModule } from '@angular/common';
  import { FormsModule } from '@angular/forms';
  import { Report } from '../../models/display.model';
  import { DisplayApiService } from '../../services/display-api.service';

  type StatusFilter = 'OPEN' | 'RESOLVED' | 'ALL';

  @Component({
    selector: 'app-admin',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
      <div style="height:100%;overflow-y:auto;background:#f8fafc;padding-bottom:40px">
        <div style="max-width:700px;margin:0 auto;padding:28px 20px 0">

          <!-- Header -->
          <div style="margin-bottom:24px">
            <div style="font-weight:800;font-size:22px;color:#0f172a;margin-bottom:4px">
              ⚙ Admin Dashboard
            </div>
            <div style="font-size:13.5px;color:#64748b">Moderate reports and manage displays</div>
          </div>

          <!-- Stats -->
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px">
            <div *ngFor="let stat of stats()"
                 style="background:white;border-radius:12px;padding:16px;
                        box-shadow:0 1px 6px rgba(0,0,0,0.06);text-align:center">
              <div style="font-weight:800;font-size:24px;color:#0f172a">{{stat.value}}</div>
              <div style="font-size:12px;color:#64748b;margin-top:2px">{{stat.label}}</div>
            </div>
          </div>

          <!-- Reports section -->
          <div style="background:white;border-radius:16px;overflow:hidden;
                      box-shadow:0 1px 6px rgba(0,0,0,0.06)">
            <!-- Tab bar -->
            <div style="display:flex;border-bottom:1px solid #f1f5f9">
              <button *ngFor="let f of filters" (click)="setFilter(f.id)"
                      [style.color]="statusFilter() === f.id ? 'var(--accent-dark)' : '#64748b'"
                      [style.border-bottom]="statusFilter() === f.id ? '2px solid var(--accent)' : '2px solid transparent'"
                      style="flex:1;border:none;border-top:none;border-left:none;border-right:none;
                             background:none;padding:13px;font-size:13.5px;font-weight:600;
                             cursor:pointer;transition:color 0.15s">
                {{f.label}}
                <span style="font-size:11px;color:#94a3b8;font-weight:500"> ({{getCount(f.id)}})</span>
              </button>
            </div>

            <!-- Loading -->
            <div *ngIf="loading()" style="padding:48px;text-align:center;color:#94a3b8;font-size:14px">
              Loading…
            </div>

            <!-- Report rows -->
            <ng-container *ngIf="!loading()">
              <div *ngFor="let r of filteredReports(); let last = last"
                   [style.border-bottom]="last ? 'none' : '1px solid #f8fafc'"
                   style="padding:18px 20px">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
                  <div style="flex:1">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                      <span [style.background]="getReasonBg(r.reason)"
                            [style.color]="getReasonColor(r.reason)"
                            style="font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:99px">
                        {{r.reason}}
                      </span>
                      <span [style.background]="r.status === 'OPEN' ? '#fef3c7' : '#dcfce7'"
                            [style.color]="r.status === 'OPEN' ? '#92400e' : '#166534'"
                            style="font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:99px">
                        {{r.status}}
                      </span>
                    </div>
                    <div style="font-weight:600;font-size:14px;color:#0f172a;margin-bottom:3px">
                      {{r.displayTitle}}
                    </div>
                    <div style="font-size:12.5px;color:#64748b;margin-bottom:6px">{{r.notes}}</div>
                    <div style="font-size:11.5px;color:#9ca3af">{{r.createdAt}}</div>
                  </div>
                  <div style="display:flex;flex-direction:column;gap:7px;flex-shrink:0">
                    <button *ngIf="r.status === 'OPEN'" (click)="resolve(r)"
                            style="padding:6px 14px;border-radius:8px;font-size:12.5px;font-weight:600;
                                   background:#22c55e;color:white;border:none;cursor:pointer">
                      Resolve
                    </button>
                    <button *ngIf="r.status === 'OPEN'" (click)="dismiss(r)"
                            style="padding:6px 14px;border-radius:8px;font-size:12.5px;font-weight:600;
                                   background:none;border:1.5px solid #e2e8f0;color:#64748b;cursor:pointer">
                      Dismiss
                    </button>
                    <span *ngIf="r.status !== 'OPEN'"
                          style="font-size:12px;color:#94a3b8;text-align:center">Done</span>
                  </div>
                </div>
              </div>

              <div *ngIf="filteredReports().length === 0"
                   style="padding:48px;text-align:center;color:#94a3b8;font-size:14px">
                No reports to show
              </div>
            </ng-container>
          </div>
        </div>
      </div>
    `
  })
  export class AdminComponent implements OnInit {
    statusFilter = signal<StatusFilter>('OPEN');
    reports = signal<Report[]>([]);
    loading = signal(true);

    filters: { id: StatusFilter; label: string }[] = [
      { id: 'OPEN', label: 'Open' },
      { id: 'RESOLVED', label: 'Resolved' },
      { id: 'ALL', label: 'All' },
    ];

    constructor(private displayApi: DisplayApiService) {}

    ngOnInit() {
      this.loadReports();
    }

    setFilter(id: StatusFilter) {
      this.statusFilter.set(id);
      this.loadReports();
    }

    private loadReports() {
      this.loading.set(true);
      this.displayApi.getReports(this.statusFilter()).subscribe({
        next: page => { this.reports.set(page.content); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
    }

    stats = computed(() => {
      const all = this.reports();
      return [
        { label: 'Open Reports', value: all.filter(r => r.status === 'OPEN').length },
        { label: 'Resolved', value: all.filter(r => r.status === 'RESOLVED').length },
        { label: 'Total Loaded', value: all.length },
      ];
    });

    filteredReports = computed(() => {
      const f = this.statusFilter();
      return f === 'ALL' ? this.reports() : this.reports().filter(r => r.status === f);
    });

    getCount(f: StatusFilter) {
      return f === 'ALL' ? this.reports().length : this.reports().filter(r => r.status === f).length;
    }

    resolve(r: Report) {
      this.displayApi.updateReport(r.id, 'RESOLVED').subscribe({
        next: updated => this.reports.update(list => list.map(x => x.id === r.id ? updated : x)),
      });
    }

    dismiss(r: Report) {
      this.displayApi.updateReport(r.id, 'DISMISSED').subscribe({
        next: updated => this.reports.update(list => list.map(x => x.id === r.id ? updated : x)),
      });
    }

    getReasonBg(reason: string) {
      const map: Record<string, string> = { 'WRONG_ADDRESS': '#ede9fe', 'OFFENSIVE': '#fee2e2', 'SPAM': '#fef3c7', 'INACTIVE': '#e0f2fe' };
      return map[reason] ?? '#f1f5f9';
    }

    getReasonColor(reason: string) {
      const map: Record<string, string> = { 'WRONG_ADDRESS': '#5b21b6', 'OFFENSIVE': '#991b1b', 'SPAM': '#92400e', 'INACTIVE': '#075985' };
      return map[reason] ?? '#374151';
    }
  }
  ```

- [ ] **Step 2: Full compile check — should be zero errors**

  ```bash
  cd frontend && npx tsc --noEmit 2>&1 | grep -v "node_modules"
  ```

  Expected: no output (clean compile).

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/app/pages/admin/admin.component.ts
  git commit -m "feat: wire AdminComponent to real reports API with resolve/dismiss actions"
  ```

---

## Task 11: App Component — Fix Remaining Type References

Clean up leftover `Display` references in `app.component.ts` now that `selectedDisplay` is `DisplaySummary`.

**Files:**
- Modify: `frontend/src/app/app.component.ts`

- [ ] **Step 1: Update Display import**

  Find:
  ```ts
  import { Display } from './models/display.model';
  ```
  Replace with:
  ```ts
  import { DisplaySummary } from './models/display.model';
  ```

  Find:
  ```ts
  selectedDisplay = signal<import('./models/display.model').DisplaySummary | null>(null);
  ```
  Replace with:
  ```ts
  selectedDisplay = signal<DisplaySummary | null>(null);
  ```

  Find:
  ```ts
  openDetail(display: import('./models/display.model').DisplaySummary) {
  ```
  Replace with:
  ```ts
  openDetail(display: DisplaySummary) {
  ```

  Also update the `MapComponent` event binding. In the template, find:
  ```html
  (viewDetails)="openDetail($event)"
  ```
  This is already compatible. No change needed.

  Update profile's `(selectDisplay)` binding — find in template:
  ```html
  <app-profile *ngIf="screen() === 'profile'"
    [user]="authService.currentUser()"
    style="display:block;height:100%"
    (selectDisplay)="openDetail($event)"/>
  ```
  This is already compatible since `openDetail` now takes `DisplaySummary`.

- [ ] **Step 2: Final clean compile**

  ```bash
  cd frontend && npx tsc --noEmit 2>&1 | grep -v "node_modules"
  ```

  Expected: no output.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/src/app/app.component.ts
  git commit -m "fix: clean up Display → DisplaySummary type references in AppComponent"
  ```

---

## Task 12: End-to-End Smoke Test

Verify the full stack works together with Docker + backend + frontend running.

- [ ] **Step 1: Start Docker**

  ```bash
  docker-compose up -d
  ```

  Expected: PostgreSQL container running.

- [ ] **Step 2: Start backend**

  In a terminal:
  ```bash
  source backend/.env && cd backend && ./mvnw spring-boot:run
  ```

  Wait for: `Started ChristmasLightMapApplication in X seconds`

- [ ] **Step 3: Start frontend**

  In a second terminal:
  ```bash
  cd frontend && ng serve
  ```

  Wait for: `Local: http://localhost:4200/`

- [ ] **Step 4: Verify map loads with real data**

  Open `http://localhost:4200` in a browser.

  Expected:
  - Map renders (no console errors about SAMPLE_DISPLAYS)
  - Search API called — console network tab shows `GET /api/v1/displays/search?lat=...`
  - Tags loaded from API — filter chips populate after a moment
  - If database is seeded, pins appear; if empty, map shows "No displays found"

- [ ] **Step 5: Verify auth flow**

  Click "Sign in" → modal appears → click "Continue with Google".

  Expected: browser redirects to `http://localhost:8080/oauth2/authorization/google` (Google consent screen if credentials are configured in backend `.env`, or 500 if they aren't yet).

  If Google credentials are not configured, that's expected — the auth endpoint exists and the redirect works; Google just won't authenticate.

- [ ] **Step 6: Verify tags endpoint**

  In browser devtools Network tab, find the tags request.

  Expected: `GET http://localhost:8080/api/v1/tags` → 200 with `{"success":true,"data":[...]}`.

- [ ] **Step 7: Final commit**

  ```bash
  git add .
  git commit -m "chore: API integration complete — Plan 4 done"
  ```

---

## Summary

After this plan, the full stack is wired:

| Feature | Before | After |
|---|---|---|
| Map pins | `SAMPLE_DISPLAYS` (8 static) | Real PostGIS radius search |
| Auth | Mock toggle button | Google OAuth2 → HttpOnly JWT |
| Upvotes | Local signal (loses on refresh) | HTTP POST/DELETE with optimistic UI |
| Submit | No-op "done" screen | POST to API with Nominatim geocoding |
| Profile | `SAMPLE_DISPLAYS.slice(0,2)` | `/displays/mine` + `/displays/upvoted` |
| Admin | `SAMPLE_REPORTS` (5 static) | Real paginated reports, live resolve/dismiss |
| Tags | `ALL_TAGS` constant | Loaded from `/api/v1/tags` |
