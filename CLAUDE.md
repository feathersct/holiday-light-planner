# Holiday Light Planner — Claude Context

## Project
Community holiday light display map. Users discover, submit, upvote, and manage displays on an interactive map.

## Stack
- **Frontend:** Angular 17 standalone components, signals, no NgModules. `frontend/`
- **Backend:** Spring Boot 3.5, Spring Security OAuth2 + JWT HttpOnly cookie. `backend/`
- **Database:** PostgreSQL + PostGIS (location stored as `GEOGRAPHY(POINT,4326)` column named `location`, NOT `lat`/`lng`)
- **Storage:** Cloudflare R2, served via `https://cdn.eventmapster.com`
- **Auth:** Facebook OAuth2 only (Google removed). JWT cookie set on login.

## Deployment
- **Frontend:** Cloudflare Pages → `eventmapster.com` (build output: `frontend/dist/frontend/browser`)
- **Backend:** Railway → `api.eventmapster.com` (root dir: `backend/`)
- **Database:** PostGIS template on Railway (standard Postgres won't work — no PostGIS extension)
- Railway redeploys automatically on push to `main`
- Cloudflare Pages redeploys automatically on push to `main`

## Key Backend Facts
- `SessionCreationPolicy.IF_REQUIRED` — required for OAuth2 flow (STATELESS breaks it)
- `server.forward-headers-strategy=NATIVE` — required for Railway reverse proxy
- Spring Boot does NOT auto-load `.env` locally. Run: `export $(grep -v '^#' .env | xargs) && mvn spring-boot:run`
- Flyway migrations in `backend/src/main/resources/db/migration/` — append-only, never edit existing
- PostGIS coordinates: extract with `ST_Y(location::geometry)` (lat) and `ST_X(location::geometry)` (lng)
- Facebook app is in Development mode — only admin/test users can log in until submitted for Facebook review

## Key Frontend Facts
- `environment.ts` = production, `environment.development.ts` = local dev
- Production API: `https://api.eventmapster.com`
- `withCredentials: true` on all HTTP requests (JWT cookie)
- `isMobile = window.innerWidth < 768` used throughout for responsive layout
- Bottom tab bar handles mobile navigation — navbar links hidden on mobile

## Conventions
- Angular: inline templates in `.ts` files (no separate `.html` files), inline styles
- No comments unless the WHY is non-obvious
- Backend DTOs in `dto/request/` and `dto/response/`
- Soft-delete pattern: `is_active = false` for user deletes; hard delete for admin deletes
- All API responses wrapped in `ApiResponse<T> { success, data }`
- Tags seeded via Flyway, not user-created

## Running Locally
```bash
# Backend + DB (first run downloads Maven dependencies — ~3 min)
docker compose up

# Frontend (separate terminal)
cd frontend
npm start
```

To trigger a Spring Boot hot-reload without restarting the container:
```bash
mvn compile -f backend/pom.xml
```

## Agent Instructions when running subagent-driven-development
When we do subagent-driven development, run implementation tasks on Haiku instead of Sonnet