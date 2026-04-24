# Christmas Light Map — Project Brief

## What We're Building
A community-driven, public-facing full-stack web app where users can discover, submit, and upvote Christmas light displays on an interactive map. Think Yelp meets Google Maps but exclusively for holiday light displays. It is intended as a personal hobby project with real product potential — seasonal ad revenue, premium features, and neighbourhood partnerships are future possibilities.

---

## Target Audience
Open to the public from day one. Anyone can browse the map. Submitting a display or upvoting requires a free account.

---

## Tech Stack (non-negotiable — developer is familiar with these)
- **Backend:** Java 17 + Spring Boot 3.x
- **Frontend:** Angular 17+ (standalone components, signals)
- **Database:** PostgreSQL 15+ with PostGIS extension
- **Auth:** OAuth 2.0 via Google and Facebook only — no username/password accounts
- **File Storage:** Cloudflare R2 (S3-compatible API) for user photo uploads
- **Migrations:** Flyway
- **Maps:** Google Maps JS SDK
- **Hosting (recommended):** Railway or Render to start; migrate to AWS/GCP if it grows

---

## Core Features (MVP — Phase 1)

### Map & Discovery
- Interactive Google Map as the home page
- Display pins clustered by area when zoomed out
- Radius-based search (default 10 miles) using PostGIS `ST_DWithin`
- Filter displays by tags (e.g. animated, music-synced, walk-through)
- Filter by display type: drive-by, walk-through, or both

### Display Listings
- Each display has: title, description, address, city, state, postcode, geolocation, best time to visit, display type, tags, photos
- Primary photo shown as cover image on map pin and listing card
- Displays go live only after the submitting user has verified their email
- Soft delete only — `is_active = false`, never hard DELETE

### User Accounts
- Sign up / log in via Google or Facebook OAuth only
- No passwords stored anywhere
- User profile shows their submitted displays and upvoted displays
- Role system: `user` (default) and `admin`

### Upvotes
- Upvotes only — no star ratings, no downvotes (chosen deliberately to avoid discouraging homeowners)
- One upvote per user per display
- `upvote_count` on the displays table is maintained by a PostgreSQL trigger, not application code

### Photo Uploads
- Users can upload photos to any display (not just ones they submitted)
- Photos stored in Cloudflare R2, referenced by URL in the database
- One photo per display can be marked `is_primary = true` (enforced by partial unique index)
- `photo_count` on displays maintained by a DB trigger

### Moderation
- Users can report displays (reasons: spam, wrong address, offensive, duplicate, other)
- Reports reviewed by admins via a moderation dashboard
- Report statuses: open → reviewed → resolved / dismissed

---

## Phase 2 Features (post-MVP)
- **Light tour route builder** — users chain multiple displays into a shareable driving route
- **Season toggle** — homeowners or admins mark displays active/inactive each year without losing history
- **Display claiming** — homeowners can claim their own listing to manage it directly
- **Structured opening hours** — replace the `best_time` free text field with proper hours

---

## Database Schema (already designed — 8 tables)

| Table | Purpose |
|---|---|
| `users` | OAuth-based user accounts |
| `displays` | Core listing table with PostGIS `GEOGRAPHY(POINT)` location column |
| `display_photos` | Photos for each display, stored in R2 |
| `upvotes` | One row per user+display upvote, triggers update `upvote_count` |
| `tags` | Admin-managed reference list of filterable tags |
| `display_tags` | Many-to-many join between displays and tags |
| `seasons` | Year-by-year active status per display |
| `reports` | User moderation reports |

### Key DB notes
- `displays.location` is `GEOGRAPHY(POINT, 4326)` — always use `ST_DWithin()` for distance queries, distance in metres
- `upvote_count` and `photo_count` are denormalised — maintained by triggers, never update in Java code
- Use `org.locationtech.jts.geom.Point` for the JPA entity field
- All migrations use Flyway, numbered V1–V10, located in `backend/src/main/resources/db/migration/`
- PostGIS extension enabled in V1 — must run before any spatial columns are created

---

## Project Structure (monorepo — 1 GitHub repo)
```
christmas-light-map/
├── CLAUDE.md                          ← Claude Code project context (already created)
├── PROJECT_BRIEF.md                   ← This file
│
├── backend/                           ← Spring Boot
│   └── src/main/
│       ├── java/com/christmaslightmap/
│       │   ├── model/                 ← JPA entities (all 8 created)
│       │   ├── repository/            ← Spring Data repos (DisplayRepository created)
│       │   ├── service/               ← Business logic (TODO)
│       │   ├── controller/            ← REST controllers (TODO)
│       │   ├── dto/                   ← Request/Response DTOs (TODO)
│       │   └── config/                ← Security, CORS, Storage config (TODO)
│       └── resources/
│           ├── application.properties ← Created with placeholders
│           └── db/migration/          ← V1–V10 SQL scripts (all created)
│
└── frontend/                          ← Angular
    └── src/app/
        ├── core/
        │   ├── auth/                  ← AuthService with signals (created)
        │   ├── guards/                ← authGuard, adminGuard (created)
        │   ├── interceptors/          ← credentialsInterceptor (created)
        │   └── services/              ← DisplayService (created)
        ├── features/
        │   ├── map/                   ← Home page map (TODO)
        │   ├── displays/              ← Detail page + submit form (TODO)
        │   ├── profile/               ← User profile (TODO)
        │   └── admin/                 ← Moderation dashboard (TODO)
        └── shared/
            └── models/                ← display.model.ts, user.model.ts (created)
```

---

## What Has Already Been Built
- ✅ Full database schema document (Word doc)
- ✅ All 10 Flyway SQL migration scripts (V1–V10)
- ✅ All 7 JPA entity classes (User, Display, DisplayPhoto, Upvote, Tag, Season, Report)
- ✅ DisplayRepository with PostGIS native radius query
- ✅ AuthService (Angular, signal-based)
- ✅ DisplayService (Angular)
- ✅ credentialsInterceptor (Angular)
- ✅ authGuard + adminGuard (Angular)
- ✅ app.routes.ts with lazy-loaded routes
- ✅ Shared TypeScript models (Display, User, ApiResponse, PagedResponse)
- ✅ environment.ts + environment.prod.ts
- ✅ application.properties with all config keys (placeholders for secrets)
- ✅ CLAUDE.md with full project context for Claude Code

---

## What Still Needs Building (priority order)

### Backend
1. **SecurityConfig** — Spring Security OAuth2 + JWT HttpOnly cookie setup, CORS config
2. **JwtService** — issue, validate, and parse JWT tokens
3. **OAuth2UserService** — handle post-OAuth login, create/update user record
4. **DisplayController** — REST endpoints for search, get, create, upvote, photo upload, report
5. **DisplayService** — business logic for all display operations
6. **TagController / TagService** — serve tag list for filter UI
7. **AuthController** — `/auth/me` and `/auth/logout` endpoints
8. **StorageService** — upload/delete photos via Cloudflare R2 (AWS SDK S3 client)
9. **AdminController** — report management endpoints
10. **DTOs** — request/response objects for all endpoints
11. **pom.xml** — add all required dependencies

### Frontend
1. **MapComponent** — Google Maps integration, display pins, clustering, radius search
2. **DisplayCardComponent** — reusable card shown in map sidebar and list views
3. **DisplayDetailComponent** — full display page with photos, tags, upvote button
4. **SubmitDisplayComponent** — form to submit a new display with address geocoding
5. **ProfileComponent** — user's submitted and upvoted displays
6. **AdminComponent** — report queue and moderation actions
7. **NavbarComponent** — top nav with login/logout and user avatar
8. **AppComponent** — root component wiring everything together

---

## API Conventions
- Base path: `/api/v1`
- All responses: `{ success: boolean, data: T, message?: string }`
- Paginated lists: Spring `Page<T>` → `{ content, totalElements, totalPages, size, number }`
- Auth via JWT in HttpOnly cookie — Angular sends via `withCredentials: true`
- Protected endpoints checked by Spring Security JWT filter

## Key API Endpoints Needed
```
GET    /api/v1/displays/search     lat, lng, radiusMiles, tags, displayType, sort, page, size
GET    /api/v1/displays/:id
POST   /api/v1/displays            auth required
POST   /api/v1/displays/:id/photos auth, multipart file upload
POST   /api/v1/displays/:id/upvote auth
DELETE /api/v1/displays/:id/upvote auth
POST   /api/v1/displays/:id/report auth
GET    /api/v1/tags
GET    /api/v1/auth/me
POST   /api/v1/auth/logout
GET    /api/v1/admin/reports       admin only
PATCH  /api/v1/admin/reports/:id   admin only
```

---

## Running Locally
```bash
# 1. Start PostgreSQL with PostGIS
docker run -p 5432:5432 -e POSTGRES_PASSWORD=changeme postgis/postgis:15-3.3

# 2. Run backend (Flyway migrations run automatically on startup)
cd backend && ./mvnw spring-boot:run

# 3. Run frontend
cd frontend && ng serve
# App available at http://localhost:4200
# API at http://localhost:8080
```

---

## Key Decisions Summary (for context)
| Decision | Choice | Reason |
|---|---|---|
| Auth method | Google + Facebook OAuth only | No password management, simpler security |
| Ratings | Upvotes only | Avoid discouraging homeowners with negative feedback |
| Submission flow | Email verification required | Quality control before going public |
| Map provider | Google Maps | Polished, familiar, pairs well with Google OAuth |
| Hosting | Railway/Render to start | Dead simple for Spring Boot + Postgres, free tier |
| Storage | Cloudflare R2 | No egress fees vs AWS S3 |
| Repo structure | Monorepo | Easier for solo dev, Claude Code gets full context |