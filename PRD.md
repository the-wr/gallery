# Personal Travel Photo Gallery — Product Requirements

**Status:** Draft for discussion · **Owner:** (you) · **Last updated:** 2026-06-19

> A self-hosted, online gallery for personal travel photos. It exists because
> generic services (Google Photos, etc.) can't express *layered* albums, mixed
> photo-and-narrative content, geographic browsing, and a clean public/private
> split — all in one place.

This document covers **what** and **why**, not **how**. No technology choices yet.

---

## 1. Vision

One home for all my travels where a single trip is told at the depth the viewer
wants — a few postcard shots for a casual visitor, the full chronological story
for me, every face-bearing photo for family — without maintaining duplicate
albums. The front door is a world map; the inside is part photo album, part
illustrated travelogue.

## 2. Goals

- **Layered storytelling.** One album, multiple density levels, switchable in place.
- **Mixed content.** Photos interleaved with optional maps and written narrative.
- **Geographic browsing.** A world map and country index as primary navigation.
- **Structured trips.** Big trips can nest per-location sub-albums with seamless navigation.
- **Low-friction publishing.** Upload photos; let the system extract as much
  structure (location, country, layer) as it can automatically.
- **Clean public/private boundary.** A polished public portfolio, with inner
  (face-bearing) layers reachable only by private share links.

## 3. Non-goals (for now)

- Not a photo *editor* (no cropping, filters, retouching).
- Not a full social network (no public comments, likes, follows, feeds).
- Not a backup/sync service or a replacement for primary photo storage.
- Not multi-tenant — this is **my** gallery, not a platform for others to host theirs.
- No printing/photo-book ordering, no e-commerce.

## 4. Audience & access model

The gallery serves two viewer types from the same content:

| Viewer | Sees | Access |
|---|---|---|
| **Public visitor** | Outer (curated) layers; maps, narrative; world index | Open, link- and search-discoverable |
| **Trusted viewer** (family/friends) | Everything, including the inner face-bearing layer | Global private share link (no account required) |
| **Me (owner)** | Everything + editing/upload | Authenticated |

**Privacy principle:** a layer boundary doubles as the privacy boundary. The
outer layers form the **public portfolio**; one or more **inner layers are
private** and only exposed through a shareable link that the owner generates.
A public visitor should never see private photos and ideally not even know how
many exist.

**Share link:** a single **global "family" link** unlocks all private (inner)
layers across the whole gallery. It is an **unguessable URL**; once it has been
used to unlock a session, the token is **removed from the visible browser URL**
(so it isn't leaked via shoulder-surfing, history, or an accidentally re-shared
address bar). No account or password required. (Revocation/expiry — see §11.)

## 5. Core concept — Layers

A **layer** is a depth-of-detail view of the *same* album. Layers are **nested
supersets**: each outer layer is a strict subset of the next inner one.

V1 uses one fixed global layer set (outer → inner):

1. **Postcards** — a handful of the very best shots (~O(10) photos). The "show me the highlight" view.
2. **Highlights** — the strong set most viewers want; the default landing view.
3. **Chronology** — the complete photographic story in time order (~O(300) photos on big trips).
4. **Faces** — everything, including photos containing faces and personal moments. *(private)*

Requirements:

- **R-L1** A viewer can switch layers in place; the album re-renders without leaving the page or losing their position where reasonable.
- **R-L2** Because layers are nested, a photo carries a *minimum layer* (the outermost layer it appears in) and automatically appears in all inner layers too.
- **R-L3** A photo's minimum layer should be **derivable automatically from its rating/stars** where available (e.g. 5★ → Postcards, 4★ → Highlights), with manual override.
- **R-L4** The default layer shown on first load is configurable per album (default: Highlights).
- **R-L5** The privacy cut is fixed for v1: **Faces** is private and requires the share link; Postcards, Highlights, and Chronology are public.
- **R-L6** The layer set is fixed for v1. Albums may hide empty layers, but custom layer names/counts/privacy cuts are future work.
- **R-L7 Switcher control — two modes, scroll-driven.** A **named segmented control** with two presentations:
  - **Large mode** — icon + label + per-layer photo count for each layer.
  - **Small mode** — icons only (compact).

  Behavior on the trip page:
  - It **starts in large mode, pinned in-flow just below the trip title**.
  - As the viewer **scrolls down** and that pinned position leaves the viewport, it **shrinks to small mode** and **floats as an always-visible overlay in a screen corner** ("hover" mode), so the layer control is reachable at any scroll depth.
  - **Scrolling back to the top**, where the in-flow position is visible again, **transforms the floating small mode back into the large pinned mode** (it re-docks home).

  Exact iconography, which corner, and the transition animation are mockup-phase details (§11).
- **R-L8 Private layer in the switcher.** The **Faces** segment appears only once the family link has unlocked the session; to anonymous visitors the switcher shows public layers only, with no hint of a hidden one (privacy, §4).

### 5.1 Layer switcher behavior

Guiding principle: switching a layer **changes the density of the same album in
place** — zooming detail in/out around where the viewer already is — rather than
loading a new page.

- **R-L9 Anchor on switch.** Switching does **not** jump to the top. The photo nearest the viewport stays put and the page re-flows around it. Switching to a shallower layer that omits the current photo anchors to the **nearest surviving photo**.
- **R-L10 Animate in place.** Going deeper *inserts* photos between existing ones; going shallower *removes* them. Photos common to both layers keep their position. No hard reload.
- **R-L11 Layer-dependent sections.** A section (sub-album) with no photos in the current layer collapses/disappears, heading included. A section that is *entirely* private photos therefore does not exist in public layers — this is also the privacy mechanism for anonymous visitors.
- **R-L12 Preserve view state.** A section's collapsed/expanded state, and any per-layer photo counts shown on the switcher, are unaffected by switching (counts describe the album, not the current view).
- **R-L13 Persistence — sticky + remembered.** The chosen layer carries across trips within a visit *and* is remembered on the next visit (stored per-device). If an album hides that layer because it has no photos there, the viewer falls back to the nearest non-empty public layer. The very first album of a brand-new viewer uses that album's default until the switcher is touched.
- **R-L14 Layer in the URL.** The current layer is reflected in the URL so a specific layer view can be shared/bookmarked (e.g. `?l=postcards`). **Precedence: explicit URL layer → remembered/sticky preference → album default.**
- **R-L15 Private layer is always gated.** A remembered or URL-specified **Faces** view still requires the family-link unlock; without a valid unlock it **silently falls back** to the deepest public layer, revealing nothing about the private content.

> Note: layers here are **density** (how many photos). Re-orderings that aren't
> supersets — e.g. "by location" vs "by person" — are a *different* axis ("views").
> Out of scope for v1 unless cheap; flagged in §10.

## 6. Albums, sub-albums & navigation

A trip is read as a **single continuous page** you scroll end-to-end (like a
magazine feature), not a hub of separate child pages. Sub-albums are **sections
within that page**, not destinations you navigate into.

- **R-A1 Trip = album = one page.** The basic unit is a trip album (title, dates, cover, location(s), optional intro) presented as one scrollable page.
- **R-A2 Sub-albums as sections.** A multi-location trip is organised into **sections** (e.g. one per city/location), each with its own heading, laid out in sequence on the same page. At least one level of sectioning is required; nested sub-sections are desirable.
- **R-A3 Collapsible sections.** Each section can be **collapsed/expanded** to keep a long trip manageable; a section list / "jump to" affordance lets the viewer skip between sections without leaving the page (this replaces page-to-page sibling nav).
- **R-A4 No breadcrumbs; single "up" link.** With a fixed 3-level depth (World → Country → Trip) and a one-page trip, no breadcrumb trail is needed — browser-back handles normal navigation. The only gap is **direct arrivals** (shared trip link, or a tile-per-trip world catalogue that jumps straight to a trip) with no in-site history; for them a single always-present **"up" affordance** (to the country / home) is enough. In-trip movement is scroll + jump-to-section, not drill in/out.
- **R-A5 Inherited context.** A section inherits trip-level context (dates, region) but can override its own dates/label where useful. Section-level maps are later work.
- **R-A6 Layer consistency.** The layer choice applies to the **whole page** at once (all sections) and persists as the viewer scrolls; switching layers re-renders in place without losing position where reasonable (R-L1).
- **R-A7 Performance at length.** Because a full trip (≈300 photos on the inner layer) lives on one page, content must **lazy-load** as the viewer scrolls so the page stays fast (R-X1).

## 7. Rich content blocks (beyond photos)

An album is a sequence of **sections**, not just a photo grid. V1 favors a guided
layout over a full magazine editor: photos default into chronological groups, and
the owner can tune section headings, captions, covers, layer assignment, and a
small amount of emphasis without hand-building every block.

- **R-C1 Photos** — single full-width "hero" images and multi-image grouped rows. Defaults choose a clean chronological layout; the owner can mark a small number of hero photos and adjust grouping when needed. **Captions are optional** — a photo may have none.
- **R-C2 Text blocks** — trip intro and section notes/headings, plus optional per-photo captions. Arbitrary interleaved prose blocks and custom heading levels are later work.
- **R-C3 Single trip map — frozen for viewers.** A trip may have one optional overview map, generated from photo GPS and shown near the top of the album. Viewers see a static image with no live map service, no pan/zoom, and no runtime dependency. The owner can accept, hide, regenerate, or replace it.
- **R-C4 Route & heatmap (later)** — drawn routes, shooting-density heatmaps, multiple local maps, and an interactive map editor are not v1 requirements.
- **R-C5 Ordering** — photos default to chronological order; the owner can reorder sections and photo groups, with fine-grained freeform layout deferred.
- **R-C6 One caption per photo** — a photo shows the **same** caption in every layer it appears in (no per-layer caption variants).

### 7.1 Lightbox / fullscreen

Fullscreen is a focused **look-closer** tool, not a second narrative — the
scrolling page remains the story. Prev/next is therefore **scoped to the photo
group**, and group boundaries eject the viewer back into the page flow.

- **R-C7 Group-scoped stepping.** Tapping a photo in a grouped row opens a fullscreen viewer that flips **only across that group's photos**. A hero/standalone photo is a "group of one." Text and maps are never part of the lightbox.
- **R-C8 Boundaries eject into the narrative.** Flipping **past the last** photo of a group **closes the lightbox and scrolls the page to the next content block**; flipping **before the first** closes and scrolls to the **previous** block (symmetric). The "next/previous block" is the adjacent item in the album sequence, whatever its type (text, map, or another photo group). This keeps the page as the connective tissue between groups.
- **R-C9 Zoom to inspect.** Within the viewer, pinch/scroll to zoom into a photo at full resolution for detail.
- **R-C10 Caption when present.** A photo's caption is shown in the viewer if it has one (captions are optional, R-C1); nothing is shown when absent.
- **R-C11 Return in place.** Dismissing (Esc / close / swipe-down) returns to the **exact prior scroll position**. Minimal chrome; no EXIF/metadata panel in v1.

## 8. World index (the front door)

**One template, two levels.** The front door and the country screen are the
**same layout** — a **static map on top + a scrollable catalogue below** — used at
two scopes (World, then Country). There is **no view toggle**: map and catalogue
coexist on one normal scrollable page. Designed for O(100) trips with a heavily
skewed distribution (some countries 10+ trips, some only 1).

**The map is a static/frozen image with a clickable pin overlay** — not a live,
pannable, or zoomable map (consistent with the per-album frozen-map principle,
R-C3; no map tiles/service at runtime). Pins are positioned hotspots layered over
the static image: clickable, with hover (desktop) / tap (mobile) previews.
"Drilling in" = navigating to the next static image (world → per-country), **not**
zooming.

- **R-I1 World level — map.** A static world image with **one pin per country** (count badge, e.g. "Japan · 12"). Hover/tap shows a preview (country name, trip count, representative thumbnail); click opens that country's page. One pin per country absorbs the skew — no overlapping piles.
- **R-I2 World level — catalogue with a granularity toggle.** Below the map, a scrollable catalogue is the discoverability-first path (not the map). A **toggle — styled consistently with the trip-page layer switcher (R-L7)** — lets the viewer choose granularity:
  - **Countries** — one tile per country; tapping opens that country's page (its trip gallery). Compact overview.
  - **Trips** — one tile per trip; every album visible directly (sorted by date), more tiles per country. Maximum discoverability.

  The viewer's choice is remembered like other view preferences.
- **R-I3 Country level — same template.** A country page reuses the layout: a baked **country image with one pin per trip** (hover/tap = trip preview: cover, title, dates; click = open trip), above a grid/list of that country's trips. A 1-trip country still lands here for consistency; a 12-trip country is a focused mini-index with a shareable per-country URL.
- **R-I4 Auto-placement** — country and trip pins are derived automatically from extracted photo GPS / reverse-geocoded country, not hand-placed (owner can adjust).
- **R-I5 Frozen maps** — both world and country maps are pre-rendered static images; the only interactivity is the pin overlay (click + hover/tap preview). No pan, no zoom, no live map dependency.
- **R-I6 Privacy-aware** — the public index shows only public content; the private inner layer never leaks into counts, badges, pins, or previews shown to anonymous visitors.
- **R-I7 Visited-summary (desirable)** — lightweight "places I've been" sense (e.g. visited countries highlighted on the world image) for at-a-glance scope.
- **R-I8 Sort (desirable)** — the catalogue can offer a chronological sort toggle in addition to the default country grouping.

### 8.1 Catalogue tiles

Tiles use a **uniform grid** (consistent landscape aspect, aligned rows) with the
**caption below** the cover image — an "index-card" style chosen for legibility
and fast scanning at O(100) trips. Covers are cropped to the fixed ratio.
**No badges, no stacked/multi-image edges** — minimal, low-noise tiles: a cover
plus a two-part caption.

Tile captions are **context-dependent** — the primary identifier matches the
scope (country at world level, trip title once inside a country):

- **R-I9 Country tile** — world page, **Countries** mode. Cover + caption:
  `<country> · <date range> · <X albums>` (e.g. "Japan · 2018–2023 · 12 albums").
- **R-I10 Trip tile** — caption varies by where it appears (no photo counts in either):
  - World page, **Trips** mode: `<country> · <date>` (country is the salient label at world scope).
  - Country page: `<title> · <date>` (e.g. "Kyoto in Autumn · Nov 2022"; country is implied by context).
- **R-I11 Privacy on tiles.** Private (Faces) content never contributes to a cover, caption, or count shown to anonymous visitors (R-I6); no private indicator is rendered on public tiles.
- **R-I12 Uniform covers.** All covers crop to one aspect ratio for aligned rows; the owner can pick which photo is the cover and, ideally, adjust its crop focal point.

## 9. Content workflow & automatic metadata

The owner adds content by **uploading photos through a web UI**; the system does
the structural heavy lifting by **extracting metadata automatically**, with
manual override everywhere.

- **R-W1 Web upload** — drag-and-drop upload, review auto-created sections/groups, assign layers, choose covers, and caption in the browser.
- **R-W2 GPS → location** — extract photo GPS to power the optional trip overview map and world/country index pins.
- **R-W3 Location → country** — reverse-geocode to a country (and ideally region/city) to drive the world map pin and country index automatically.
- **R-W4 Time → order** — use capture timestamps to build the default chronological ordering and trip date range.
- **R-W5 Rating → layer** — use the photo's star rating to assign its minimum layer automatically (see R-L3).
- **R-W6 Manual privacy** — the private (Faces) layer is defined **manually** by the owner assigning photos to it. No face detection in v1.
- **R-W7 Manual override** — core extracted values (country/location, order, layer, section, caption, cover, map visibility) are editable.
- **R-W8 Graceful gaps** — photos missing GPS/timestamp/rating still work (no map pin, fall back to upload order, default layer).

## 10. Experience & quality bar

- **R-X1 Fast, image-first** — large photos load quickly and look great; browsing feels smooth.
- **R-X2 Responsive** — works well on phone and desktop (travel galleries get shared and viewed on phones).
- **R-X3 Visual polish** — this is a public portfolio; layout and typography should feel considered, not utilitarian.
- **R-X4 Shareable** — individual albums (and share links) produce nice previews when shared.
- **R-X5 Durable & ownable** — content is self-hosted and exportable; no lock-in to a third party's terms.

## 11. Decisions & remaining questions

**Decided:**

- **Share link** → one global "family" link, unguessable URL, token removed from the visible address bar after unlock (§4).
- **Layer model** → fixed global four-layer set for v1 (Postcards, Highlights, Chronology, Faces); Faces is private (§5). Custom layer sets are later work.
- **Views vs layers** → density layers only; no orthogonal re-orderings in v1.
- **Faces & privacy** → manual layer assignment, no detection/automation in v1 (R-W6).
- **Comments/notes** → owner-authored only.
- **Captions** → one caption per photo, identical across layers (R-C6).
- **Map** → frozen static images for viewers. V1 has world/country index maps plus one optional trip overview map; routes, heatmaps, multiple album maps, and an interactive map editor are later work (R-C3/R-C4).
- **Front door** → one template (static map on top + scrollable catalogue below) reused at World and Country levels; map and catalogue **coexist (no Map↔Catalogue toggle)**, but the world catalogue has a **Countries ⇄ Trips granularity toggle** (R-I2). Maps are frozen images with a clickable/hoverable **pin overlay** (no pan/zoom/live map); world pins = countries, country pins = trips. Tile captions are context-dependent: country tiles `country · date range · X albums`; trip tiles `country · date` at world level and `title · date` on a country page — no photo counts (R-I9/R-I10).
- **Scale** → albums/trips O(100); per trip ~O(300) photos on the inner (Faces) layer, ~O(10) on Postcards. Index and album designs must stay comfortable at this scale.

**Still open:**

1. **Share-link lifecycle:** does the global link need rotation/revocation (regenerate to invalidate an over-shared old link), or is set-once acceptable for v1?
2. **Pin placement on frozen maps:** pins are auto-placed from GPS, but on a non-zoomable world image, dense regions (e.g. several European countries) may crowd. Acceptable as-is, or do we need a minimum spacing / manual nudge step?
3. **Layer switcher visuals (R-L7):** two-mode behavior is decided; **prototype in mockups** the iconography, which screen corner the floating small mode lives in, and the large⇄small transition animation.

## 12. Possible future (explicitly later)

- Orthogonal "views" (by person, by place) layered on top of density layers.
- Custom per-album layer sets / custom privacy cuts.
- Full magazine-style layout editor with arbitrary interleaved blocks.
- Multiple album maps, routes, heatmaps, and interactive map editing.
- Lightweight private notes/reactions from trusted viewers.
- Timeline / "this trip N years ago" resurfacing.
- Search (by place, date, caption text).
- Multi-language captions.

---

### Priority snapshot (for the next conversation)

- **Must-have v1:** fixed global layered albums (§5), trip + flat section structure (§6), guided photo layout with captions/section notes and one optional frozen trip overview map (§7), front door = static map + scrollable catalogue reused at World/Country levels with a clickable pin overlay (§8), web upload with GPS/country/rating extraction (§9), global private share-link split (§4).
- **Should-have:** collapsible sections, visited-country summary, light manual map replacement/regeneration.
- **Could-have / later:** §12 items.
