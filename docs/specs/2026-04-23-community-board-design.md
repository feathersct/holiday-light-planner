# Community Board — Unified Listings Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand the app from a Christmas lights map into a general location-based community board where users discover anything they can physically go to — lights, yard sales, estate sales, pop-up markets, and food trucks — all on one map.

**Architecture:** Single unified `listings` table (renamed from `displays`) with a `category` column and shared base fields. Category-specific fields are nullable typed columns on the same table. The frontend shows/hides fields per category. Listings auto-expire server-side once `end_datetime` passes.

**Tech Stack:** Spring Boot 3.5 / PostgreSQL + PostGIS / Angular 17 standalone components / Flyway migrations

---

## Categories

| Value | Label |
|---|---|
| `CHRISTMAS_LIGHTS` | Christmas Lights |
| `YARD_SALE` | Yard / Garage Sale |
| `ESTATE_SALE` | Estate Sale |
| `POPUP_MARKET` | Pop-up Market |
| `FOOD_TRUCK` | Food Truck |

---

## Data Model

### Flyway V12 — migrate `displays` → `listings`

**Rename table and update foreign keys:**
- Rename `displays` → `listings`
- Update foreign keys in `display_photos`, `upvotes`, `display_tags`, `reports`

**Add columns:**

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `category` | `VARCHAR(30)` | NOT NULL | Default `'CHRISTMAS_LIGHTS'` for existing rows |
| `start_datetime` | `TIMESTAMP` | NOT NULL | Season start for lights; event start for others |
| `end_datetime` | `TIMESTAMP` | NOT NULL | Listings auto-hide after this passes |
| `cuisine_type` | `VARCHAR(100)` | NULL | Food trucks only |
| `organizer` | `VARCHAR(255)` | NULL | Estate sales only — company running the sale |
| `website_url` | `VARCHAR(500)` | NULL | Christmas Lights + Food Trucks only |
| `price_info` | `VARCHAR(255)` | NULL | Optional on all — e.g. "Free", "$8 admission", "$8–$14 plates" |

**Existing columns kept as-is:**
- `display_type` (`DRIVE_BY`, `WALK_THROUGH`, `BOTH`) — lights only, nullable for other categories
- `best_time` (VARCHAR 255) — lights only, nightly viewing window e.g. "5:30pm–11pm"
- All other existing columns unchanged

**Backfill existing rows:**
```sql
UPDATE listings SET
  category = 'CHRISTMAS_LIGHTS',
  start_datetime = '2024-12-01 00:00:00',
  end_datetime   = '2025-01-05 23:59:59'
WHERE category IS NULL;
```

**New indexes:**
```sql
CREATE INDEX idx_listings_category ON listings (category);
CREATE INDEX idx_listings_end_datetime ON listings (end_datetime);
```

### Category-specific field matrix

| Field | Christmas Lights | Yard Sale | Estate Sale | Pop-up Market | Food Truck |
|---|---|---|---|---|---|
| `display_type` | ✓ | — | — | — | — |
| `best_time` | ✓ | — | — | — | — |
| `cuisine_type` | — | — | — | — | ✓ |
| `organizer` | — | — | ✓ | — | — |
| `website_url` | ✓ | — | — | — | ✓ |
| `price_info` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `start_datetime` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `end_datetime` | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## Backend

### Renamed / updated classes

| Old | New |
|---|---|
| `Display` entity | `Listing` entity |
| `DisplayType` enum | Keep as-is (lights only) |
| `DisplayController` | `ListingController` |
| `DisplayService` | `ListingService` |
| `DisplayResponse` | `ListingResponse` |
| `DisplaySummaryResponse` | `ListingSummaryResponse` |
| `CreateDisplayRequest` | `CreateListingRequest` |
| URL prefix `/api/v1/displays` | `/api/v1/listings` |

### New `Category` enum
```java
public enum Category {
    CHRISTMAS_LIGHTS, YARD_SALE, ESTATE_SALE, POPUP_MARKET, FOOD_TRUCK
}
```

### `Listing` entity additions
```java
@Enumerated(EnumType.STRING)
@Column(nullable = false)
private Category category;

@Column(nullable = false)
private LocalDateTime startDatetime;

@Column(nullable = false)
private LocalDateTime endDatetime;

@Column
private String cuisineType;      // FOOD_TRUCK only

@Column
private String organizer;        // ESTATE_SALE only

@Column
private String websiteUrl;       // CHRISTMAS_LIGHTS + FOOD_TRUCK only

@Column
private String priceInfo;        // optional, all categories
```

### `CreateListingRequest` validation
- `category`, `startDatetime`, `endDatetime`, `title`, `address`, `city`, `state`, `postcode` — all required
- `endDatetime` must be after `startDatetime`
- `displayType` required when `category == CHRISTMAS_LIGHTS`
- `cuisineType` accepted only when `category == FOOD_TRUCK`
- `organizer` accepted only when `category == ESTATE_SALE`
- `websiteUrl` accepted only when `category` is `CHRISTMAS_LIGHTS` or `FOOD_TRUCK`

### Search endpoint changes (`GET /api/v1/listings/search`)
- Add optional `category` query param to filter by category
- Add `AND end_datetime >= NOW()` to all queries by default
- Admin endpoint (`GET /api/v1/listings/search?includeExpired=true`) bypasses the expiry filter

### `ListingSummaryResponse` additions
```java
private Category category;
private LocalDateTime startDatetime;
private LocalDateTime endDatetime;
private String priceInfo;
private String cuisineType;
private String organizer;
private String websiteUrl;
```

---

## Frontend

### Rebrand
- All "Holiday Light Planner" text replaced with new brand name (TBD by user)
- All `display` terminology updated to `listing` in models, services, and UI labels
- `display.model.ts` → `listing.model.ts`; `DisplayApiService` → `ListingApiService`

### Map page
- Category filter chips replace the current display-type chips:
  `All · Christmas Lights · Yard Sales · Estate Sales · Pop-up Markets · Food Trucks`
- Map markers use a color per category (distinct from the current drive-by/walk-through colors)
- Listing cards show: category badge, date range, price if set
- Upcoming listings (`startDatetime > now`) show a "Starts [date]" badge instead of hiding
- Expired listings never appear (filtered server-side)

### Submit form (`/submit`)
- Category picker at top — drives which fields are shown below:

| Field | All | Lights | Food Truck | Estate Sale |
|---|---|---|---|---|
| Title, Description, Address | ✓ | ✓ | ✓ | ✓ |
| Start / End datetime pickers | ✓ | ✓ | ✓ | ✓ |
| Price info | ✓ | ✓ | ✓ | ✓ |
| Photos | ✓ | ✓ | ✓ | ✓ |
| Display type | — | ✓ | — | — |
| Best time (nightly hours) | — | ✓ | — | — |
| Tags | — | ✓ | — | — |
| Website URL | — | ✓ | ✓ | — |
| Cuisine type | — | — | ✓ | — |
| Organizer | — | — | — | ✓ |

### Detail modal
- Category badge and date range shown prominently at top
- Category-specific fields rendered inline (cuisine type, organizer, clickable website link)
- "Get Directions" button present for all categories

### Profile page (`/profile`) — "My Listings"
- Shows all listings across all categories with category badge on each card
- Active listings shown normally
- Expired listings shown in muted style with "Ended" label (visible for user history, not on map)

### Admin page (`/admin`)
- Listings table gains category column and category filter
- `includeExpired=true` param used so admin can see and manage expired listings

---

## What is NOT changing
- Auth flow (Facebook OAuth, JWT cookie) — unchanged
- Photo upload (Cloudflare R2) — unchanged
- Upvotes — apply to all listing categories as-is
- Reports — apply to all listing categories as-is
- Tags — remain lights-only for now (can be extended to other categories later)
- Deployment (Railway + Cloudflare Pages) — unchanged

---

## Open Items
- **Brand name** — user to decide; all "Holiday Light Planner" references update once chosen
- **Category marker colors** — to be decided during frontend implementation
- **Existing lights `start_datetime`/`end_datetime`** — admin should review and correct backfilled dates after migration
