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
- **Mixed content.** Photos interleaved with maps, routes, and written narrative.
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
| **Public visitor** | Outer (curated) layers; maps, routes, narrative; world index | Open, link- and search-discoverable |
| **Trusted viewer** (family/friends) | Everything, including inner face-bearing layers | Private share link (no account required) |
| **Me (owner)** | Everything + editing/upload | Authenticated |

**Privacy principle:** a layer boundary doubles as the privacy boundary. The
outer layers form the **public portfolio**; one or more **inner layers are
private** and only exposed through a shareable link that the owner generates.
A public visitor should never see private photos and ideally not even know how
many exist.

> Open question: is a share link scoped per-album, per-trip, or one global
> "family link"? Can links expire or be revoked? (see §11)

## 5. Core concept — Layers

A **layer** is a depth-of-detail view of the *same* album. Layers are **nested
supersets**: each outer layer is a strict subset of the next inner one.

Proposed default layers (outer → inner):

1. **Postcards** — a handful of the very best shots. The "show me the highlight" view.
2. **Highlights / Most** — the strong set most viewers want; the default landing view.
3. **Full / Chronology** — the complete photographic story in time order.
4. **Family / All** — everything, including photos containing faces and personal moments. *(private)*

Requirements:

- **R-L1** A viewer can switch layers in place; the album re-renders without leaving the page or losing their position where reasonable.
- **R-L2** Because layers are nested, a photo carries a *minimum layer* (the outermost layer it appears in) and automatically appears in all inner layers too.
- **R-L3** A photo's minimum layer should be **derivable automatically from its rating/stars** where available (e.g. 5★ → Postcards, 4★ → Highlights), with manual override.
- **R-L4** The default layer shown on first load is configurable per album (default: Highlights).
- **R-L5** The privacy cut between "public" and "private" layers is configurable; layers inside the cut require a share link.
- **R-L6** Layer names/counts are a sensible default but should be customizable, since not every trip needs all four.

> Note: layers here are **density** (how many photos). Re-orderings that aren't
> supersets — e.g. "by location" vs "by person" — are a *different* axis ("views").
> Out of scope for v1 unless cheap; flagged in §10.

## 6. Albums, sub-albums & navigation

- **R-A1 Trip = album.** The basic unit is a trip album with a title, dates, cover image, location(s), and an optional intro.
- **R-A2 Nesting.** An album may contain **sub-albums** (e.g. a multi-country trip → one sub-album per location/city). Nesting of at least 2 levels is required; arbitrary depth is desirable.
- **R-A3 Seamless navigation.** Moving into a sub-album and back is fluid (clear breadcrumb / up-navigation, next/previous between sibling sub-albums).
- **R-A4 Inherited context.** A sub-album inherits trip-level context (dates, region) but can override.
- **R-A5 Layer consistency.** Switching layers should apply across the whole trip (parent + sub-albums), so the chosen depth persists as the viewer navigates.
- **R-A6 Collapsible structure.** Within a long album, sections (e.g. per-day or per-place) can be collapsible to keep browsing manageable.

## 7. Rich content blocks (beyond photos)

An album is a sequence of **content blocks**, not just a photo grid.

- **R-C1 Photos** — single images and multi-image groups/grids, with captions.
- **R-C2 Text blocks** — standalone prose between photos (intros, daily notes, context), plus per-photo captions.
- **R-C3 Per-album map** — an interactive map showing where photos in the current layer/album were taken (pins). Pins reflect the active layer.
- **R-C4 Route & heatmap** — optionally draw the trip route (path between locations) and/or a heatmap of shooting density.
- **R-C5 Ordering** — blocks can be arranged in a deliberate order; photos default to chronological but the owner can curate.
- **R-C6 Captions per layer (desirable)** — narrative density may differ by layer (a postcard view needs less text than the full story). At minimum, captions never break when layers switch.

## 8. World index (the front door)

- **R-I1 World map** — a global map with **pins for albums/trips**, used as a primary entry point. Clicking a pin opens the trip.
- **R-I2 Auto-placement** — pins are placed automatically from extracted photo GPS / derived location, not hand-entered.
- **R-I3 Country index** — browse by country: a list/grid of countries visited, each leading to the trips there.
- **R-I4 Catalogue view** — a conventional chronological/grid list of all trips as an alternative to the map.
- **R-I5 Privacy-aware** — the public index shows only public content; private inner layers never leak into counts, pins, or previews shown to anonymous visitors.
- **R-I6 Visited-summary (desirable)** — lightweight "places I've been" sense (highlighted countries / pin clustering) for at-a-glance scope.

## 9. Content workflow & automatic metadata

The owner adds content by **uploading photos through a web UI**; the system does
the structural heavy lifting by **extracting metadata automatically**, with
manual override everywhere.

- **R-W1 Web upload** — drag-and-drop upload, arrange, and caption in the browser.
- **R-W2 GPS → location** — extract photo GPS to power per-album maps, routes, and heatmaps.
- **R-W3 Location → country** — reverse-geocode to a country (and ideally region/city) to drive the world map pin and country index automatically.
- **R-W4 Time → order** — use capture timestamps to build the default chronological ordering and trip date range.
- **R-W5 Rating → layer** — use the photo's star rating to assign its minimum layer automatically (see R-L3).
- **R-W6 Face presence → privacy (desirable)** — detect whether a photo contains faces to help route it into the private inner layer. Owner reviews; never auto-publishes a face photo to public.
- **R-W7 Manual override** — every extracted value (location, country, order, layer, caption) is editable.
- **R-W8 Graceful gaps** — photos missing GPS/timestamp/rating still work (no map pin, fall back to upload order, default layer).

## 10. Experience & quality bar

- **R-X1 Fast, image-first** — large photos load quickly and look great; browsing feels smooth.
- **R-X2 Responsive** — works well on phone and desktop (travel galleries get shared and viewed on phones).
- **R-X3 Visual polish** — this is a public portfolio; layout and typography should feel considered, not utilitarian.
- **R-X4 Shareable** — individual albums (and share links) produce nice previews when shared.
- **R-X5 Durable & ownable** — content is self-hosted and exportable; no lock-in to a third party's terms.

## 11. Open questions

1. **Share links:** per-album, per-trip, or one global "family" link? Expiry/revocation? Password vs unguessable URL?
2. **Layer count:** is a fixed 4-layer model right, or fully custom per album? Minimum viable set for v1?
3. **Views vs layers:** do we need orthogonal re-orderings (by-location, by-person) in v1, or are density layers enough?
4. **Faces & privacy:** how much automation is trustworthy? Manual review gate assumed — confirm.
5. **Comments/notes:** are text blocks owner-authored only, or do trusted viewers ever annotate? (Currently owner-only.)
6. **Scale:** rough number of trips and photos expected (affects browsing/index design, not in this doc but informs priorities).
7. **Captions per layer:** worth the extra authoring effort, or one caption set per photo?

## 12. Possible future (explicitly later)

- Orthogonal "views" (by person, by place) layered on top of density layers.
- Lightweight private notes/reactions from trusted viewers.
- Timeline / "this trip N years ago" resurfacing.
- Search (by place, date, caption text).
- Multi-language captions.

---

### Priority snapshot (for the next conversation)

- **Must-have v1:** layered albums (§5), trip + sub-album nesting (§6), photo + text + per-album map blocks (§7), world map + country index (§8), web upload with GPS/country/rating extraction (§9), public/private share-link split (§4).
- **Should-have:** routes/heatmap, collapsible sections, face-presence assist, per-layer captions.
- **Could-have / later:** §12 items.
