# Christmas Light Map — Implementation Design

**Date:** 2026-04-19
**Status:** Approved

---

## Overview

A community-driven full-stack web app where users discover, submit, and upvote Christmas light displays on an interactive map. Built with Spring Boot 3.x (backend) and Angular 17+ (frontend), PostgreSQL + PostGIS, OAuth2 via Google and Facebook, photo storage on Cloudflare R2, and Google Maps JS SDK.

---

## Key Decisions

| Decision | Choice |
|---|---|
| Auth method | Google + Facebook OAuth2 only — no passwords |
| JWT storage | HttpOnly cookie (SameSite=Strict, 7-day expiry) |
| Auth flow | Spring OAuth2 Client → custom OAuth2UserService → JwtService → cookie |
| Ratings | Upvotes only (no downvotes, no star ratings) |
| Denormalized counts | `upvote_count`, `photo_count` maintained by DB triggers — never update in Java |
| Soft delete | `is_active = false` only — no hard DELETEs |
| Local DB | Docker Compose (PostgreSQL 15 + PostGIS) |
| Testing | Key integration tests only (Spring `@SpringBootTest`) — no unit tests for every class |
| CI/CD | Out of scope for MVP |
| Storage | Cloudflare R2 via AWS SDK S3 client |

---

## Implementation Structure

Four sequential plans, each independently executable and verifiable before the next begins.

---

## Plan 1 — Backend Foundation

### Goals
Stand up a working Spring Boot app with OAuth2 login, JWT auth, and a connected PostgreSQL database. A developer completing this plan should be able to log in with Google, receive a JWT cookie, and call `/api/v1/auth/me` successfully.

### External Setup (prerequisites)
- Create Google Cloud project → enable Google+ API → create OAuth2 credentials (client ID + secret). Redirect URI: `http://localhost:8080/login/oauth2/code/google`
- Create Facebook Developer app → enable Facebook Login. Redirect URI: `http://localhost:8080/login/oauth2/code/facebook`
- Create Cloudflare R2 bucket + API token (read/write). Note: bucket used in Plan 2 — credentials wired here.

### Project Setup
- Initialize Spring Boot 3.x project via Spring Initializr
- `pom.xml` dependencies: `spring-boot-starter-web`, `spring-boot-starter-security`, `spring-boot-starter-oauth2-client`, `spring-boot-starter-data-jpa`, `postgresql`, `flyway-core`, `jjwt-api` + `jjwt-impl` + `jjwt-jackson`, `hibernate-spatial`, `aws-sdk-s3`, `lombok`, `spring-boot-starter-test`
- `docker-compose.yml` at repo root: `postgis/postgis:15-3.3` image, port 5432, env vars for DB name/user/password

### Database
- Flyway migrations V1–V10 in `backend/src/main/resources/db/migration/`:
  - V1: Enable PostGIS extension
  - V2: `users` table (id, provider, provider_id, email, name, avatar_url, role, created_at)
  - V3: `displays` table with `GEOGRAPHY(POINT, 4326)` location column
  - V4: `display_photos` table + partial unique index on `is_primary`
  - V5: `upvotes` table
  - V6: `tags` table
  - V7: `display_tags` join table
  - V8: `seasons` table
  - V9: `reports` table
  - V10: DB triggers for `upvote_count` and `photo_count`

### JPA Entities
All 8 entities in `model/` package: `User`, `Display`, `DisplayPhoto`, `Upvote`, `Tag`, `Season`, `Report`, `DisplayTag`. `Display.location` field typed as `org.locationtech.jts.geom.Point`.

### Security Architecture

```
com.christmaslightmap/
├── config/
│   ├── SecurityConfig.java       ← Spring Security filter chain; @EnableMethodSecurity for @PreAuthorize
│   ├── CorsConfig.java           ← Allow localhost:4200 (dev) + prod domain
│   └── StorageConfig.java        ← S3Client bean → Cloudflare R2 endpoint
├── security/
│   ├── JwtService.java           ← issue/validate/parse JWT (HS256, secret from properties)
│   ├── JwtAuthFilter.java        ← OncePerRequestFilter, reads "jwt" HttpOnly cookie
│   └── OAuth2UserService.java    ← extends DefaultOAuth2UserService, upserts user record
├── model/                        ← JPA entities
├── repository/
│   └── UserRepository.java       ← findByProviderAndProviderId(provider, providerId)
└── controller/
    └── AuthController.java       ← GET /api/v1/auth/me, POST /api/v1/auth/logout
```

**JWT claims:** `sub` (userId as string), `email`, `role`, `iat`, `exp` (7 days from issue).

**Security filter chain rules:**
- `/oauth2/**`, `/login/**` → permit all
- `/api/v1/admin/**` → require `ROLE_ADMIN`
- `/api/v1/displays` (POST), `/api/v1/displays/*/upvote`, `/api/v1/displays/*/photos`, `/api/v1/displays/*/report` → require authentication
- Everything else → permit all (public browsing)

**OAuth2 success handler:** Issues JWT, sets HttpOnly cookie, redirects browser to `http://localhost:4200`.

**Logout:** Clears cookie with `Max-Age=0`, returns 200.

### application.properties
All config keys with placeholders: DB URL/credentials, JWT secret, Google client ID/secret, Facebook client ID/secret, R2 endpoint/bucket/access key/secret key, max file upload size (10MB).

### Integration Test
`AuthControllerTest`: call `GET /api/v1/auth/me` without cookie → assert 401. Call with valid JWT cookie → assert 200 + correct user JSON.

---

## Plan 2 — Backend Features

### Goals
All API endpoints working and testable via Postman. A developer completing this plan should be able to search displays by radius, create a display, upvote, upload a photo, and file a report.

### Package additions to Plan 1 structure

```
├── service/
│   ├── DisplayService.java
│   ├── TagService.java
│   ├── PhotoService.java         ← R2 upload/delete via StorageConfig S3Client
│   └── AdminService.java
├── controller/
│   ├── DisplayController.java
│   ├── TagController.java        ← GET /api/v1/tags
│   └── AdminController.java      ← @PreAuthorize("hasRole('ADMIN')")
├── dto/
│   ├── request/
│   │   ├── CreateDisplayRequest.java
│   │   ├── UpdateReportRequest.java
│   │   └── ReportRequest.java
│   └── response/
│       ├── DisplayResponse.java         ← full display detail
│       ├── DisplaySummaryResponse.java  ← for map pins + cards
│       ├── UserResponse.java
│       ├── TagResponse.java
│       └── ApiResponse.java             ← { success, data, message? }
└── repository/
    ├── DisplayRepository.java    ← native PostGIS query
    ├── TagRepository.java
    ├── UpvoteRepository.java     ← existsByUserIdAndDisplayId
    └── ReportRepository.java
```

### API Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /api/v1/displays/search | public | lat, lng, radiusMiles, tags, displayType, sort, page, size |
| GET | /api/v1/displays/:id | public | |
| POST | /api/v1/displays | required | creates display with `is_active=true` |
| POST | /api/v1/displays/:id/photos | required | multipart, max 10MB |
| POST | /api/v1/displays/:id/upvote | required | 409 if already upvoted |
| DELETE | /api/v1/displays/:id/upvote | required | |
| POST | /api/v1/displays/:id/report | required | |
| GET | /api/v1/tags | public | |
| GET | /api/v1/auth/me | required | (from Plan 1) |
| POST | /api/v1/auth/logout | required | (from Plan 1) |
| GET | /api/v1/admin/reports | admin | paginated, filterable by status |
| PATCH | /api/v1/admin/reports/:id | admin | update status |

### Key Behaviors
- **Radius search:** `ST_DWithin(location, ST_MakePoint(:lng, :lat)::geography, :radiusMetres)` where `radiusMetres = radiusMiles * 1609.34`. Tags and displayType are optional WHERE clauses. Returns `Page<DisplaySummaryResponse>`.
- **Photo upload:** `PhotoService` uploads file to R2 using S3Client, constructs public URL `https://<bucket>.<r2-account>.r2.cloudflarestorage.com/<key>`, saves `DisplayPhoto` record. DB trigger increments `photo_count`.
- **Soft delete:** `DisplayService` sets `is_active = false` — no repository `delete()` calls.
- **Display activation:** The brief mentions email verification before a display goes live. Since auth is OAuth2-only, Google/Facebook have already verified the user's email. New displays are created with `is_active = true` immediately — no separate verification step needed.
- **All responses:** Wrapped in `ApiResponse<T>`. Paginated lists use Spring `Page<T>` → `PagedResponse<T>`.

### Integration Tests
- `DisplaySearchTest`: seed 3 displays at known coordinates, search with 10-mile radius → assert correct count returned.
- `UpvoteTest`: upvote → assert 200 + count incremented. Upvote again → assert 409. Delete upvote → assert 200 + count decremented.
- `PhotoUploadTest`: POST multipart file → assert 200 + URL in response + `photo_count` incremented.
- `ReportTest`: POST report → assert open report created in DB.

---

## Plan 3 — Frontend Foundation

### Goals
Angular app running at `localhost:4200` with working OAuth2 login. A developer completing this plan should be able to click "Login with Google", complete the OAuth flow, and see their name/avatar in the navbar.

### Project Init
```bash
ng new frontend --standalone --routing --style=scss
cd frontend
npm install @angular/google-maps
```

### Structure

```
frontend/src/app/
├── core/
│   ├── auth/
│   │   └── auth.service.ts           ← signals: currentUser, isLoggedIn, isAdmin
│   ├── guards/
│   │   ├── auth.guard.ts             ← redirects to '/' if not authenticated
│   │   └── admin.guard.ts            ← redirects to '/' if not admin
│   ├── interceptors/
│   │   └── credentials.interceptor.ts ← adds withCredentials: true to all requests
│   └── services/
│       └── display.service.ts        ← all display/tag/upvote/photo/report API calls
├── features/
│   ├── map/map.component.ts
│   ├── displays/
│   │   ├── display-detail/display-detail.component.ts
│   │   └── submit-display/submit-display.component.ts
│   ├── profile/profile.component.ts
│   └── admin/admin.component.ts
└── shared/
    ├── models/
    │   ├── display.model.ts          ← Display, DisplaySummary, CreateDisplayRequest
    │   └── user.model.ts             ← User, UserRole
    └── components/
        └── navbar/navbar.component.ts
```

### Auth Service (signal-based)
```ts
currentUser = signal<User | null>(null);
isLoggedIn = computed(() => !!this.currentUser());
isAdmin = computed(() => this.currentUser()?.role === 'ADMIN');

init(): void  // called in AppComponent — fetches /auth/me, sets currentUser
login(): void  // navigates to /oauth2/authorization/google (full page redirect)
logout(): void  // POST /auth/logout, then currentUser.set(null)
```

### Routes (app.routes.ts)
```ts
{ path: '', loadComponent: () => MapComponent }
{ path: 'displays/:id', loadComponent: () => DisplayDetailComponent }
{ path: 'submit', canActivate: [authGuard], loadComponent: () => SubmitDisplayComponent }
{ path: 'profile', canActivate: [authGuard], loadComponent: () => ProfileComponent }
{ path: 'admin', canActivate: [adminGuard], loadComponent: () => AdminComponent }
```

### Environment Files
- `environment.ts`: `{ apiUrl: 'http://localhost:8080', googleMapsApiKey: '' }`
- `environment.prod.ts`: production values (placeholders)

### NavbarComponent
Displays app name/logo. If `isLoggedIn`: shows avatar + name + logout button. If not: shows "Login with Google" button. Uses `AuthService` signals directly.

### AppComponent
Calls `authService.init()` in `ngOnInit`. Contains `<app-navbar>` and `<router-outlet>`.

### End-to-End Verification
Start Docker Compose + Spring Boot backend + Angular dev server. Click "Login with Google" → complete OAuth → verify navbar shows user avatar. Call `GET /api/v1/auth/me` from browser devtools → verify 200 response.

---

## Plan 4 — Frontend Features

### Goals
Complete, working UI for all MVP features: map with pins, display detail, submit form, profile, admin dashboard.

### Components

**MapComponent** (`features/map/`)
- Loads Google Maps via `@googlemaps/js-api-loader` with `googleMapsApiKey` from environment
- On map `idle` event: calls `DisplayService.search()` with current map center + radius
- Renders results as `AdvancedMarkerElement` pins; clusters with `MarkerClusterer`
- Clicking a pin opens `DisplayCardComponent` in a right-side panel
- Tag filter chips (multi-select) + display type toggle (drive-by / walk-through / both) above the map — changes trigger a new search
- Default radius: 10 miles

**DisplayCardComponent** (`shared/components/display-card/`)
- Input: `@Input() display: DisplaySummary`
- Shows: cover photo, title, city/state, upvote count, primary tags
- Standalone — no router dependency; parent provides `[routerLink]`

**DisplayDetailComponent** (`features/displays/display-detail/`)
- Loads full display by ID from route params
- Photo gallery (primary photo large, thumbnails below)
- Tags displayed as chips
- Upvote button: optimistic UI (increment on click, roll back on error), disabled + tooltip if not logged in
- Photo upload input (auth required): POST multipart to `/displays/:id/photos`
- "Report this display" link → inline form (reason dropdown + optional note)

**SubmitDisplayComponent** (`features/displays/submit-display/`)
- Form fields: title, description, address, city, state, postcode, best time, display type, tags (multi-select from `/api/v1/tags`)
- "Verify Address" button: geocodes address via Google Maps Geocoding API → shows lat/lng + mini-map pin preview
- Lat/lng populated from geocoding result — never entered manually by user
- On submit: POST to `/api/v1/displays` → redirect to new display detail page

**ProfileComponent** (`features/profile/`)
- Two tabbed sections: "My Displays" and "Upvoted Displays"
- Each section renders a list of `DisplayCardComponent`
- Fetches from `DisplayService` filtered by current user

**AdminComponent** (`features/admin/`)
- Table of reports: display title, reporter name, reason, date submitted, current status
- Inline status dropdown: reviewed → resolved / dismissed
- On change: PATCH `/api/v1/admin/reports/:id`
- Only reachable if `isAdmin` (guarded by `adminGuard`)

### DisplayService Methods
```ts
search(params: SearchParams): Observable<PagedResponse<DisplaySummary>>
getById(id: number): Observable<Display>
create(request: CreateDisplayRequest): Observable<Display>
uploadPhoto(displayId: number, file: File): Observable<DisplayPhoto>
upvote(displayId: number): Observable<void>
removeUpvote(displayId: number): Observable<void>
report(displayId: number, request: ReportRequest): Observable<void>
getTags(): Observable<Tag[]>
getMyDisplays(): Observable<DisplaySummary[]>
getUpvotedDisplays(): Observable<DisplaySummary[]>
```

### End-to-End Verification
- Search map → pins appear within radius
- Click pin → card opens → click through to detail
- Submit a new display → appears on map
- Upvote a display → count increments
- Upload photo → appears in gallery
- Admin user can see and update reports

---

## Running Locally

```bash
# 1. Start PostgreSQL + PostGIS
docker-compose up -d

# 2. Start backend (Flyway migrations run automatically)
cd backend && ./mvnw spring-boot:run

# 3. Start frontend
cd frontend && ng serve
# App: http://localhost:4200
# API: http://localhost:8080
```
