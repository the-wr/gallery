# Personal Travel Photo Gallery — Technical Design

**Status:** Draft for review · **Companion to:** [PRD.md](PRD.md) · **Last updated:** 2026-06-27

> This document covers **how**. It turns the PRD's *what/why* into concrete
> architecture, technology choices, data models, and pipelines. Every section
> traces back to PRD requirement IDs (e.g. `R-L7`). Where the PRD left a choice
> open, this document makes a recommendation and records the alternatives.

---

## 1. Summary of the technical problem

The PRD describes a **single-tenant, self-hosted, read-heavy, image-heavy**
gallery with a few defining technical characteristics that drive every decision:

1. **Read-dominated, write-rare.** One owner uploads occasionally; many viewers
   read. The system should be near-static at the edge and only do heavy work at
   publish time. (`R-X1`, `R-X5`)
2. **"Bake, don't serve live."** Maps are frozen images, not runtime map
   services. The same philosophy generalizes: do expensive work once, on save,
   and ship static artifacts. (`R-C3`, `R-C4`, `R-I5`)
3. **Layers are nested supersets.** This is the central data invariant and the
   privacy mechanism in one. (`R-L2`, `R-L11`)
4. **Privacy by omission.** Anonymous viewers must not receive private bytes or
   metadata at all — not hidden via CSS, genuinely absent from the payload.
   (`R-I6`, `R-I11`, `R-L8`, `R-L15`)
5. **One long page per trip with in-place density switching.** Demands client
   re-flow with positional anchoring and FLIP-style animation, plus lazy media
   loading. (`R-L1`, `R-L9`, `R-L10`, `R-A7`)
6. **Durable & exportable, no lock-in.** Favors plain files + a single embedded
   database over managed cloud services. (`R-X5`)

---

## 2. Architecture overview

A single deployable full-stack app with three logical surfaces over shared
storage. Heavy processing happens in an async worker at upload/publish time; the
public read path is static-cache-friendly.

```
                         ┌───────────────────────────────────────────┐
                         │                 BROWSER                     │
                         │                                             │
  Public visitor  ──────▶│  Viewer SPA/SSR  ── layer engine (FLIP),    │
  Trusted (token) ──────▶│                     lightbox, pin overlay   │
  Owner (auth)    ──────▶│  Editor app  ── interactive MapLibre, DnD   │
                         └───────────────┬─────────────────────────────┘
                                         │ HTTPS
                  ┌──────────────────────▼───────────────────────────┐
                  │           Reverse proxy (Caddy/nginx)             │
                  │   TLS · HTTP caching · static asset serving       │
                  └──────────────────────┬───────────────────────────┘
                                         │
                  ┌──────────────────────▼───────────────────────────┐
                  │            App server (SvelteKit, Node)           │
                  │  • SSR public pages (privacy-filtered per session)│
                  │  • Auth + share-token exchange                    │
                  │  • Editor API (upload, arrange, save)             │
                  │  • Enqueues processing jobs                       │
                  └───────┬───────────────────────┬──────────────────┘
                          │                        │
          ┌───────────────▼────────┐   ┌───────────▼──────────────────┐
          │  SQLite (metadata)     │   │  Async worker (same process  │
          │  via Drizzle ORM       │   │  or sidecar)                 │
          │  WAL mode, single file │   │  • sharp: derivatives, LQIP  │
          └────────────────────────┘   │  • exifr: EXIF/GPS/rating    │
                                        │  • offline reverse-geocode   │
          ┌────────────────────────┐   │  • map bake (MapLibre→PNG)   │
          │  Object/file storage   │◀──┤  • country/world map bake    │
          │  originals + derivs +  │   └──────────────────────────────┘
          │  baked maps (on disk   │
          │  or S3-compatible)     │
          └────────────────────────┘
```

**Why one app, not microservices:** single-tenant, single-owner, modest scale
(O(100) trips, O(30k) photos lifetime). Operational simplicity and exportability
beat horizontal scalability here. (`R-X5`)

---

## 3. Technology stack & rationale

| Concern | Choice | Why | Alternatives considered |
|---|---|---|---|
| **App framework** | **SvelteKit** (SSR + client hydration) | `animate:flip` and `crossfade` are first-class — directly model the in-place layer insert/remove with positional anchoring (`R-L10`). Small JS payload aids image-first perf (`R-X1`). SSR enables true per-session privacy filtering (`R-I6`). | Next.js/React (heavier runtime, FLIP needs a lib); Astro (great for static, weaker for the stateful layer engine) |
| **Language** | **TypeScript** end-to-end | Shared types between server, editor, and viewer; safer refactors. | — |
| **Metadata DB** | **SQLite** (WAL) via **Drizzle ORM** | Single file = durable, trivially backed up and exported (`R-X5`). No DB server to run. Ample for this scale. | Postgres (overkill, adds a service); JSON files (loses query/joins for the index) |
| **Image processing** | **sharp** (libvips) | Fast resize, responsive derivatives, WebP/AVIF, blur-hash/LQIP generation. | ImageMagick (slower), browser-side (can't, originals are large) |
| **EXIF / metadata** | **exifr** | Reads GPS, timestamp, and XMP/rating reliably; pure JS. | exiftool sidecar (more powerful, adds a binary dep — keep as fallback) |
| **Reverse geocoding** | **Offline dataset** — Natural Earth admin-0 **country** polygons only for v1 | The index needs country (`R-I1`/`R-I3`); region/city is "ideally" in the PRD. Country-only drops a dataset (GeoNames) and a layer of logic — add city resolution later when something consumes it. No runtime third-party dependency, matches the "no live service" ethos (`R-C3`); runs once at upload. | Nominatim/Google API (runtime dep, rate limits, lock-in); +GeoNames cities (later) |
| **Interactive map (editor only)** | **MapLibre GL JS** | Open, no API key required with self-hostable tiles/styles; pan/zoom/draw pins & routes. | Leaflet (fine, weaker vector styling); Mapbox (license/key) |
| **Map baking** | **MapLibre headless render** → PNG/WebP base layer + **HTML hotspot overlay** for pins | Base map frozen to an image (`R-C3`, `R-I5`); pins stay as positioned, responsive, clickable HTML so they don't need re-baking and work at any screen width (`R-I1`, `R-I3`). | Fully flattened PNG incl. pins (loses responsive/clickable pins) |
| **Auth (owner)** | Session cookie + **password** (hashed, e.g. argon2) | One user; simplest complete answer. Passkey/WebAuthn deferred to later — real added surface (registration, recovery, browser quirks) for marginal gain at one user. | OAuth (needless third party); WebAuthn (later) |
| **Share access** | High-entropy token → httpOnly cookie, token stripped from URL | Matches `R-share`/§4 exactly. | Signed JWT in URL (leaks in history; same stripping problem) |
| **Deploy** | **Docker** image behind **Caddy** (auto-TLS) on a small VPS; optional CDN in front | Self-hosted, portable, exportable (`R-X5`). Caddy gives free HTTPS + caching. | PaaS (lock-in); serverless (awkward for the worker + large files) |

**Single recommended stack in one line:** *SvelteKit + TypeScript + SQLite/Drizzle
+ sharp + MapLibre, containerized behind Caddy, storing originals/derivatives on
disk (S3-compatible optional).*

---

## 4. Data model

SQLite schema (Drizzle). IDs are app-generated (ULID/NanoID) for export-stability.

```
country
  code            TEXT PK            -- ISO-3166 alpha-2 (derived, R-W3)
  name            TEXT
  world_pin_x     REAL               -- normalized 0..1 over the baked world image (R-I4)
  world_pin_y     REAL
  map_image_id    TEXT FK→asset      -- baked country base map (R-I3)
  visited         BOOLEAN            -- for visited-summary (R-I7)

trip                                  -- = album = one page (R-A1)
  id              TEXT PK
  slug            TEXT UNIQUE         -- URL (R-A4 direct arrivals)
  title           TEXT
  intro           TEXT NULL
  country_code    TEXT FK→country
  date_start      DATE                -- derived from capture times (R-W4)
  date_end        DATE
  cover_photo_id  TEXT FK→photo
  cover_focal_x   REAL                -- crop focal point (R-I12)
  cover_focal_y   REAL
  default_layer   TEXT                -- per-album default (R-L4, default 'highlights')
  privacy_cut     INTEGER             -- layer order index; >= this is private (R-L5)
  country_pin_x   REAL                -- on the country map (R-I4)
  country_pin_y   REAL
  position        INTEGER

layer                                 -- per-album layer set (R-L6)
  id              TEXT PK
  trip_id         TEXT FK→trip
  key             TEXT                -- 'postcards' | 'highlights' | ... (URL value, R-L14)
  label           TEXT
  icon            TEXT
  order_index     INTEGER             -- 0 = outermost
  -- privacy is NOT stored here: a layer is private iff order_index >= trip.privacy_cut.
  -- One source of truth (trip.privacy_cut) avoids drift (R-L5).
  UNIQUE(trip_id, order_index)

section                               -- sub-album = section on the page (R-A2)
  id              TEXT PK
  trip_id         TEXT FK→trip
  parent_id       TEXT NULL FK→section  -- reserved for nested sub-sections; UNUSED in v1 (flat sections only, R-A2)
  heading         TEXT
  date_start      DATE NULL           -- override (R-A5)
  date_end        DATE NULL
  position        INTEGER

block                                 -- ordered content stream (R-C5)
  id              TEXT PK
  trip_id         TEXT FK→trip
  section_id      TEXT NULL FK→section -- null = trip-level (before first section)
  position        INTEGER
  kind            TEXT                -- 'photo_group' | 'text' | 'map'
  -- text:
  text_md         TEXT NULL
  heading_level   INTEGER NULL        -- text-as-heading (R-C2)
  -- map:
  map_image_id    TEXT NULL FK→asset  -- baked map (R-C3)
  map_pins        JSON NULL           -- normalized hotspot coords + labels
  map_source      JSON NULL           -- editable map state (center/zoom/pins/route) to re-bake (R-C3)
  min_layer_order INTEGER             -- DERIVED on save (min over the block's photos); cache for collapse, R-L11 — never hand-edited

photo
  id              TEXT PK
  block_id        TEXT FK→block       -- belongs to a photo_group block
  asset_id        TEXT FK→asset       -- original
  position        INTEGER             -- within the group
  is_hero         BOOLEAN             -- full-width vs grouped (R-C1)
  caption         TEXT NULL           -- one caption, all layers (R-C6)
  min_layer_order INTEGER             -- THE superset key (R-L2): appears in this layer and all inner
  -- extracted metadata (all overridable, R-W7/R-W8):
  taken_at        DATETIME NULL       -- (R-W4)
  gps_lat         REAL NULL           -- (R-W2)
  gps_lng         REAL NULL
  rating          INTEGER NULL        -- stars (R-W5 → min_layer)
  width           INTEGER
  height          INTEGER
  lqip            TEXT                -- inline blur placeholder (base64/blurhash)

asset                                 -- physical file + its derivatives
  id              TEXT PK
  kind            TEXT                -- 'photo' | 'baked_map'
  original_path   TEXT
  derivatives     JSON                -- {320,1024,2048} × {avif,jpeg}, e.g. { "1024": { "avif": path, "jpeg": path }, ... }
  checksum        TEXT                -- dedupe / integrity

share_token                           -- §4 family link
  id              TEXT PK
  token_hash      TEXT                -- store only a hash (R-sec)
  created_at      DATETIME
  revoked_at      DATETIME NULL       -- rotation/revocation (open Q1, §11)
  label           TEXT NULL
```

**Key derived invariant — `min_layer_order` (`R-L2`, `R-L3`):**
on save, `photo.min_layer_order = map(rating → layer)` unless manually overridden
(`R-W5`, `R-W7`); private assignment sets it to the private layer's order
(`R-W6`). A photo with `min_layer_order = k` is included whenever the requested
layer order ≥ `k`. This single integer comparison *is* the superset filter.

A `block`'s `min_layer_order` = min over its photos (a text/map block can be
pinned to a layer or default to outermost). A `section` is "present" in layer `L`
iff any descendant block has `min_layer_order ≤ L` — used for collapse (`R-L11`).

---

## 5. The layer engine (core)

This is the heart of the system. It must satisfy `R-L1`, `R-L2`, `R-L9`–`R-L12`.

**Rendering model.** The full trip is delivered to the client as an ordered block
list, **already privacy-filtered for the session** (§6), each item tagged with
its `min_layer_order`. The client holds *all blocks the session is allowed to
see*, then renders the subset where `min_layer_order ≤ currentLayer`.

**Switching density (`R-L10`).** Going inner adds items; going outer removes them.
In Svelte this is a keyed `{#each visibleBlocks (block.id)}` with `animate:flip` —
surviving items animate to their new positions, entering/leaving items
fade/scale. Photos common to both layers keep identity and merely translate
(`R-L10`). No reload.

**Anchoring (`R-L9`).** Before a switch:
1. Find the block nearest the viewport top (the "anchor").
2. If the anchor survives the new layer, after re-render restore scroll so the
   anchor's top is at the same viewport offset.
3. If the anchor is removed (switching shallower), pick the **nearest surviving
   neighbor** (search outward in document order) as the new anchor.
   Implemented by recording `anchor.getBoundingClientRect().top` pre-switch and
   correcting `scrollTop` post-render (within a `requestAnimationFrame`/`tick`).

**Section collapse (`R-L11`).** A section with zero visible blocks in the current
layer is removed entirely, heading included. Because privacy filtering already
dropped private-only blocks for anonymous sessions, an all-private section simply
*does not exist* in their payload — the same code path delivers the privacy
guarantee.

**View state (`R-L12`).** Collapsed/expanded section state and the switcher's
per-layer counts live in client state keyed by section id and are untouched by
switching. Counts are computed from the album's full (session-permitted) block
set, not the current view.

**Switcher component (`R-L7`, `R-L8`).** A single `<LayerSwitcher>` with two
presentations driven by an `IntersectionObserver` on a sentinel at its in-flow
home position:
- Sentinel visible → **large, pinned in-flow** below the title.
- Sentinel scrolled away → **small, floating overlay** in a screen corner.
- Re-entering → re-docks to large. Transition via shared-element/`crossfade`.
The **Faces** segment is rendered only when the session is unlocked (§6); for
anonymous sessions the private layers are absent from the props entirely — no DOM
hint (`R-L8`).

**Persistence & precedence (`R-L13`, `R-L14`, `R-L15`).**
- Remembered layer stored in `localStorage` (per-device), as a layer *key*.
- On loading an album, resolve layer by precedence:
  **URL `?l=` → remembered/sticky → album `default_layer`** (`R-L14`).
- The remembered key maps to the **nearest layer this album offers** by order
  index when the album's set differs (`R-L13`).
- If the resolved layer is private and the session is not unlocked, **silently
  fall back to the deepest public layer** — never signal why (`R-L15`).

---

## 6. Privacy & access control

**Principle:** privacy is enforced **server-side at query time**, before bytes
leave the server. The client never receives private content it isn't entitled to
(`R-I6`, `R-I11`, `R-L8`, `R-L15`). CSS/JS hiding is never the mechanism.

**Session model.** Three states resolved from cookies on every request:
- `anonymous` — public layers only.
- `unlocked` — has a valid, non-revoked share cookie → may see private layers.
- `owner` — authenticated → everything + edit.

**Share-link flow (§4, `R-share`):**
1. Owner generates a token: 256-bit random, URL-safe. Stored **hashed**
   (`token_hash`) — the raw token exists only in the shared URL.
2. Visitor opens `https://…/unlock/<token>`.
3. Server constant-time-compares the hash, and if valid sets an **httpOnly,
   Secure, SameSite=Lax** session cookie marking the session `unlocked`, then
   **302-redirects to the clean destination URL** (token gone from the address
   bar — no history entry, no shoulder-surf leak). Client-side, any `?token=`
   variant is additionally scrubbed with `history.replaceState`.
4. The cookie — not the URL — carries entitlement thereafter.

**Query-time filtering.** Every read of trips/sections/blocks/photos applies a
`WHERE min_layer_order < privacy_cut` predicate for non-`unlocked` sessions. The
**world/country index** aggregates (counts, badges, covers, pins, date ranges)
are computed from the **same filtered set**, so private trips/photos never
influence a number or thumbnail shown to anonymous visitors (`R-I6`, `R-I11`).
A trip whose *every* photo is private is entirely absent from public aggregates.

**Revocation (open Q1, §11).** The `share_token` table supports multiple tokens
with `revoked_at`. Recommendation for v1: support **rotate-to-revoke** — generate
a new token, mark old ones revoked. Cheap to build now, avoids a painful retrofit
if a link over-spreads. (Set-once is the fallback if we want to ship leaner.)

**Threat notes (`R-sec`):** rate-limit `/unlock` to blunt token brute force
(256-bit makes this moot but defense-in-depth); originals for private photos are
served only through an auth-checked route, never a guessable static path; LQIP
placeholders for private photos are likewise gated.

---

## 7. Album page: content blocks & rendering

The trip page is an ordered render of `block`s within `section`s (`R-A1`–`R-A3`).

- **Photo groups (`R-C1`).** `is_hero` → full-bleed single image; otherwise a
  justified/grouped row. The owner's hero vs grouped choice is stored, not
  auto-packed — defaults assist, placement is hand-tunable (§7 intro, `R-C5`).
- **Text blocks (`R-C2`).** Markdown (sanitized) rendered to prose; `heading_level`
  promotes a text block to a section/trip heading at a chosen size.
- **Map blocks (`R-C3`, `R-C4`).** Baked image + hotspot overlay (§9). Multiple
  per page allowed; placeable anywhere via `position`.
- **Ordering (`R-C5`).** `position` integers; photos default to chronological
  (`taken_at`) at import, then owner-curated.
- **Sections (`R-A2`, `R-A3`).** Headings + collapse toggle; a "jump to section"
  menu (built from the section list) scrolls within the page — no sibling page
  nav. v1 ships **flat sections only**; `parent_id` is reserved for nested
  sub-sections later (`R-A2` calls nesting "desirable," not required).
- **Inherited context (`R-A5`).** Section dates/map fall back to trip-level unless
  overridden.
- **Single "up" affordance (`R-A4`).** A persistent up-link to the country page
  (then world), covering direct arrivals with no in-site history. No breadcrumbs.

### 7.1 Lightbox (`R-C7`–`R-C11`)

A client overlay component, opened from a photo, scoped to **its photo group
only** (a hero is a group of one).
- **Group-scoped stepping (`R-C7`).** Prev/next iterate the group's photos array.
- **Boundary eject (`R-C8`).** Stepping past the last (or before the first) closes
  the lightbox and smooth-scrolls the page to the **adjacent block** in document
  order (any kind), then restores normal flow. Implemented by resolving the
  next/prev `block` sibling and `scrollIntoView`.
- **Zoom (`R-C9`).** Pinch/wheel zoom loads the largest derivative (or original)
  on demand for full-res inspection.
- **Caption (`R-C10`).** Shown only if present.
- **Return in place (`R-C11`).** Scroll position is captured on open and restored
  on dismiss (Esc/close/swipe-down). Minimal chrome; no EXIF panel in v1.

---

## 8. Maps pipeline

Two map contexts, one shared principle: **interactive while editing, frozen for
viewers** (`R-C3`, `R-I5`).

**Editing (owner, interactive).** MapLibre GL JS in the editor: pan, zoom, place
and drag pins, draw routes, toggle a shooting-density heatmap (`R-C4`). The
editable state (center, zoom, pins, route geometry, heatmap on/off) is persisted
as `block.map_source` JSON so the owner can re-edit and re-bake later (`R-C3`).

**Baking (on save).** A headless MapLibre render produces a static base image
(PNG/WebP) at the needed widths. Routes and the heatmap are rendered **into** the
baked image (`R-C4`). **Pins are NOT flattened** — they are exported as normalized
`{x, y, label, target}` hotspots stored alongside, and rendered as absolutely
positioned, responsive, clickable HTML over the base image. This keeps pins
sharp, tappable, and accessible at any width without re-baking, while honoring
"no live map service at runtime" (`R-C3`, `R-I1`, `R-I3`).

**World & country index maps (§8).** Same mechanism at two scopes:
- **World:** one baked world image, **one pin per country** with a count badge
  (`R-I1`); hover/tap preview (name, trip count, representative thumb); click →
  country page.
- **Country:** baked country image, **one pin per trip** (`R-I3`); preview = cover,
  title, dates; click → trip.
- **Auto-placement (`R-I4`):** pin coordinates derived from photo GPS /
  reverse-geocoded country centroid, projected into the baked image's coordinate
  space and stored normalized; owner can nudge. (Open Q2 — dense-region crowding:
  the design supports an optional manual nudge + a minimum-spacing declutter pass;
  recommend shipping auto-placement first, add declutter if Europe crowds.)
- **Privacy (`R-I6`):** badges/counts/previews computed from the privacy-filtered
  set per §6.
- **Visited summary (`R-I7`):** `country.visited` drives a highlight on the world
  image (desirable).

**Catalogue below the map (`R-I2`, §8.1).** Same template at both levels; map and
catalogue coexist (no map/catalogue toggle). World catalogue has a
**Countries ⇄ Trips** granularity toggle, styled like the layer switcher (`R-I2`),
choice remembered. Tiles are a uniform landscape grid, cover + two-part caption,
context-dependent text per `R-I9`/`R-I10`, no badges/counts, covers cropped to one
ratio with owner-chosen focal point (`R-I12`). Optional chronological sort
(`R-I8`).

---

## 9. Upload & metadata extraction pipeline (`R-W1`–`R-W8`)

Owner-only, authenticated. Drag-and-drop in the editor (`R-W1`); heavy work runs
async in the worker so the UI stays responsive.

```
upload → store original → enqueue job →
  exifr: GPS (R-W2), timestamp (R-W4), rating (R-W5)
  offline reverse-geocode: country (R-W3) — region/city deferred to later
  sharp: derivatives {320,1024,2048} × {avif,jpeg}, LQIP (R-X1)
  derive: date range, default chronological order (R-W4),
          min_layer from rating map (R-W5 → R-L3)
  → write photo + asset rows → notify editor (progress)
```

- **Graceful gaps (`R-W8`):** missing GPS → no pin; missing timestamp → fall back
  to upload order; missing rating → album default layer. Nothing blocks.
- **Manual everywhere (`R-W7`):** location, country, order, layer, caption, cover,
  crop focal point are all editable post-extract.
- **Private assignment (`R-W6`):** manual only — owner assigns photos to the
  private layer (sets `min_layer_order` to the private layer). No face detection
  in v1.
- **Rating→layer map (`R-L3`):** configurable per album, default
  `5★→Postcards, 4★→Highlights, 3★→Chronology, else→Chronology`; private is never
  auto-assigned.

**Publish.** Saving a trip recomputes derived fields, re-bakes any dirty maps,
and (if using a static CDN cache) issues targeted cache invalidations for the
affected trip/country/world pages.

---

## 10. Image delivery & performance (`R-X1`, `R-X2`, `R-A7`)

- **Responsive derivatives** generated up-front by sharp; `<img srcset>` +
  `sizes` picks the right width per viewport/DPR. Three widths `{320,1024,2048}`
  × two formats **AVIF with JPEG fallback** — covers virtually all viewport/DPR
  combinations while roughly halving storage and bake time vs a 4×3 matrix.
  (WebP buys little between AVIF and JPEG in 2026; add widths/formats only if a
  real gap shows.)
- **LQIP/blur-up:** inline `lqip` (blurhash or tiny base64) shown instantly,
  swapped on load — image-first feel (`R-X1`).
- **Lazy loading (`R-A7`):** native `loading="lazy"` + `srcset` + LQIP keeps a
  ~300-photo inner-layer page light on its own — no virtualization in v1. We
  deliberately **avoid windowing / mount-unmount of offscreen groups**: it fights
  the two hardest features here — scroll **anchoring** (`R-L9`) and **FLIP**
  (`R-L10`) both need stable, measurable nodes (`getBoundingClientRect`), which
  unmounted nodes don't provide — and virtualizing a mixed-height magazine layout
  is notoriously fiddly. Revisit virtualization only if a real 300-photo page
  measures slow.
- **Caching:** immutable, content-hashed derivative URLs → long-lived cache
  headers; HTML pages cached per session-class (public pages are CDN-cacheable;
  unlocked/owner responses are `private`/`no-store`).
- **Frozen maps** are plain images — cheap, cacheable, no map-tile fetches at
  runtime (`R-I5`).

---

## 11. URL design & routing

| Page | Route | Notes |
|---|---|---|
| World index | `/` | static map + catalogue; `?g=countries\|trips` granularity (`R-I2`), `?sort=` (`R-I8`) |
| Country page | `/c/<country>` | shareable per-country (`R-I3`) |
| Trip page | `/t/<slug>` | one page; `?l=<layer>` selects density (`R-L14`); `#<section>` jump |
| Unlock | `/unlock/<token>` | sets cookie, 302 to clean URL (§6) |
| Editor | `/admin/**` | auth-gated |

Layer precedence on a trip URL: **`?l=` → remembered → album default** (`R-L14`),
with the private-gating fallback of `R-L15`.

---

## 12. Editor / admin

SvelteKit routes under `/admin`, owner-auth required. Capabilities:
drag-and-drop upload with live progress; reorder blocks/photos; mark hero vs
grouped; edit captions/text/headings; interactive MapLibre map editing + bake;
assign layers (incl. private) and per-album layer-set config (`R-L6`); set cover
+ crop focal point (`R-I12`); generate/rotate/revoke share tokens (§6); preview
as anonymous vs unlocked to validate the privacy boundary.

---

## 13. Deployment, backup & export (`R-X5`)

**Guiding principle:** the same app runs in three places — local dev, the single
VPS, and (later) a CDN/object-storage setup — distinguished only by a handful of
**environment variables**, never by code branches. This keeps "works on my
machine" honest and makes scaling out a config change, not a rewrite.

### 13.1 Production — single VPS (v1)

One box runs everything; no external services required.

```
VPS (e.g. Hetzner 2 vCPU / 4 GB)
  └─ Docker
       ├─ Caddy            → TLS (auto HTTPS) + HTTP caching + static serving
       └─ app container    → SvelteKit (SSR) + worker (sharp, map bake)
            └─ /data        (a mounted volume — survives container restarts)
                 ├─ gallery.db        SQLite (WAL)
                 └─ assets/**         originals + derivatives + baked maps
```

- **One `docker compose up`** brings up Caddy + the app. Caddy fetches/renews
  TLS certs automatically given a domain.
- **All persistent state is the `/data` volume** — the container is disposable;
  rebuild/redeploy freely without touching photos or DB.
- **Storage driver = `filesystem`** (see §13.3). Originals and derivatives are
  plain files on the volume.
- **No CDN, no object storage yet** — both are later flips (§13.5), not needed to
  ship.

### 13.2 Local development & debugging

The goal is **full parity**: run the entire stack on your laptop with no cloud
dependency, so you can debug uploads, map baking, and the privacy boundary
exactly as they behave in production.

```
Laptop
  ├─ npm run dev          → SvelteKit dev server (HMR) + worker, in-process
  └─ ./data/              → local SQLite file + ./data/assets/** image files
```

- **Two ways to run it:**
  - **Bare metal (fast inner loop):** `npm run dev`. SvelteKit hot-reloads the UI;
    the worker runs in-process. SQLite is just a file under `./data`. This is the
    default day-to-day debug mode.
  - **`docker compose up` (prod-like):** the *same* compose file as the VPS, so
    you can reproduce a production issue (Caddy, container networking, the built
    image) locally before deploying. Use this to catch "only breaks in the
    container" problems.
- **Same code path as prod:** SQLite, the `filesystem` storage driver, sharp, and
  offline geocoding all run with **zero external accounts** — nothing to mock.
  Map baking (headless MapLibre) runs locally too; if its native binary is
  awkward on a given OS, a `MAP_BAKE=stub` flag swaps in a placeholder image so UI
  work isn't blocked.
- **Config by env file:** a committed `.env.example` documents every variable; you
  copy it to `.env`. Local differs from prod only in values (`DATABASE_URL`,
  `DATA_DIR`, `BASE_URL`, `STORAGE_DRIVER=filesystem`, owner credentials,
  rate-limit toggles), not in code.
- **Seed data:** a `npm run seed` command creates a sample trip with a few photos
  and a private layer, so you can exercise layers, the lightbox, and the
  anonymous-vs-unlocked privacy preview without a real upload.
- **No HTTPS hassle locally:** dev runs over `http://localhost`; the
  cookie/`Secure` flag is relaxed when `BASE_URL` is `http://localhost` so the
  share-unlock flow is testable without certs.

### 13.3 Storage abstraction (the seam that makes the above work)

All asset reads/writes go through a small `StorageDriver` interface
(`put`, `get`, `url`, `delete`). Two implementations:

- **`filesystem`** — reads/writes under `DATA_DIR/assets`. Used for **both** local
  dev and the single-VPS v1.
- **`s3`** — talks to any S3-compatible object store (R2, etc.). Dormant until you
  choose to scale out.

Selected by `STORAGE_DRIVER`. Because every caller depends on the interface, not
on `fs` or an S3 SDK directly, moving assets off the box later touches one module.

### 13.4 Backup

- **DB:** nightly SQLite `.backup` (WAL-safe, consistent snapshot).
- **Assets:** rsync `/data/assets` to a second location (another box, a NAS, or
  object storage).
- The entire gallery is **two backupable paths** — `gallery.db` + `assets/`.

### 13.5 Scaling out later (no rewrite)

When/if you want it (§ earlier discussion): flip `STORAGE_DRIVER=s3` and point
asset URLs at a CDN. The app code is unchanged; only env vars and a one-time
migration of existing files move. Single VPS → VPS + object storage + CDN is a
**config step**, deliberately, by §13.3.

### 13.6 Export / no lock-in (`R-X5`)

The DB is a documented SQLite schema; assets are plain image files in a stable
folder structure; an `export` command can emit a fully static public snapshot
(HTML + images) for archival. Nothing is trapped in a proprietary service.

---

## 14. Security considerations

- Share tokens stored **hashed**; raw token only in the URL; constant-time
  compare; `/unlock` rate-limited.
- Private originals/derivatives/LQIP served only via session-checked routes —
  no guessable public path (§6).
- Owner auth via hashed password (argon2/bcrypt) + secure session; passkey/WebAuthn is a later upgrade, not v1.
- Markdown in text blocks sanitized to prevent stored XSS.
- Cookies: httpOnly, Secure, SameSite=Lax; CSRF protection on editor mutations.
- Uploads validated (type/size), processed off the request path, never executed.

---

## 15. How this design resolves the PRD's open questions (§11)

1. **Share-link lifecycle.** Schema + flow support **rotate-to-revoke** now
   (multiple tokens, `revoked_at`); minimal cost, avoids a retrofit. (Recommended
   over set-once.)
2. **Pin crowding on frozen maps.** Pins are HTML hotspots, not flattened, so we
   can add a **min-spacing declutter pass** and **manual nudge** without
   re-baking. Recommend ship auto-placement first, add declutter only if dense
   regions actually crowd.
3. **Layer-switcher visuals.** The two-mode `IntersectionObserver`-driven
   component is specified; iconography / corner / transition remain mockup-phase
   styling on top of the defined behavior.

---

## 16. Build phasing (maps to the PRD priority snapshot)

**Milestone 1 — Must-have v1 core**
Data model + SQLite; upload pipeline with EXIF/GPS/rating extraction + offline
**country** geocode (`R-W*`); trip page with **flat sections**, photo/text/map
blocks (`R-A*`, `R-C*`); the **layer engine** with anchoring + FLIP + persistence
(`R-L*`); privacy via query-time filtering + share-token unlock (§4/§6); world +
country index with baked maps and pin overlay (`R-I*`); lightbox (`R-C7`–`R-C11`).
Performance via native lazy + LQIP only (no virtualization). Owner auth via
password.

**Milestone 2 — Should-have**
Baked routes + shooting heatmap (`R-C4`); collapsible-section polish + jump-to;
visited-country summary (`R-I7`); chronological sort toggle (`R-I8`); share-token
rotation UI.

**Milestone 3 — Could-have / later (§12)**
Orthogonal "views" axis; trusted-viewer private notes; timeline resurfacing;
search; multi-language captions. (Schema leaves room: `min_layer_order` is one
axis; a future `view` axis is additive.)

**Deferred-by-simplification (pull in only when justified):** nested sub-sections
(`section.parent_id`); region/city geocoding (+GeoNames); passkey/WebAuthn auth;
extra derivative widths/formats; trip-page virtualization. Each has a seam left in
the design so it's additive, not a rewrite.

---

## 17. Requirements traceability (index)

- **Layers `R-L1`–`R-L15`** → §5 (engine), §6 (private gating), §11 (URL).
- **Albums/nav `R-A1`–`R-A7`** → §7, §10 (perf), §11.
- **Content blocks `R-C1`–`R-C11`** → §7, §7.1 (lightbox), §9 (maps bake).
- **World index `R-I1`–`R-I12`** → §8.
- **Workflow `R-W1`–`R-W8`** → §9.
- **Quality `R-X1`–`R-X5`** → §10 (perf/responsive), §13 (durable/export), §14.
- **Access/privacy (§4)** → §6.
- **Open questions (§11)** → §15.
```
