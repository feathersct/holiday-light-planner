# Navbar Redesign — Design Spec
**Date:** 2026-04-27

## Overview

Simplify and clarify the navigation by consolidating account actions into an avatar dropdown, moving "Add Display" to a map FAB, grouping discovery links under an Explore dropdown, and renaming "Hosts" to "Organizers" and "My Displays" to "My Account".

---

## Desktop Navbar

**Structure (left to right):**
1. Logo (navigates to map)
2. **Explore ▾** — dropdown containing:
   - Map
   - Organizers
   - *(Filters — future, not implemented now)*
3. Right side — **avatar** (logged in) or **Sign In** button (logged out)

**Avatar dropdown** (logged in):
- My Account
- Sign Out

The navbar no longer contains a standalone "Add Display" button or a "My Displays" / "My Account" link.

---

## Map Screen — Floating Action Button

- A **"+ Add Display"** button floats at the bottom-right of the map
- Visible to **logged-in users only** (hidden when logged out)
- Clicking it navigates to the submit screen (same behavior as the old nav button)

---

## Mobile

**Navbar (top bar):**
- Logo (left) + avatar (right)
- Avatar tap opens a **bottom sheet** containing:
  - My Account
  - Sign Out
- Logged-out state: Sign In button replaces avatar (same as desktop)

**Bottom tab bar:**
- **Explore** | **Organizers**
- 2 tabs only — the "Add" tab and "Profile" tab are removed
- Add Display FAB appears on the map screen (same as desktop)

---

## Terminology Changes

| Old | New | Location |
|---|---|---|
| Hosts (nav link) | Organizers | Explore dropdown |
| My Displays (nav link) | My Account | Avatar dropdown / bottom sheet |
| Add Display (nav button) | + Add Display (FAB) | Map screen, bottom-right |
| Add (mobile tab) | *(removed)* | — |
| Profile (mobile tab) | *(removed)* | — |

These renames apply everywhere the terms appear: nav labels, page titles, and any user-facing strings.

---

## Out of Scope

- Filters in the Explore dropdown (future work)
- Any changes to the submit, organizers, or account pages themselves
- Admin nav item (unchanged — remains in Explore dropdown for admin users)
