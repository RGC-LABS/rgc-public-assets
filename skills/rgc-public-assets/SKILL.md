---
name: rgc-public-assets
description: "Use when placing RGC brand artwork — logos, icons, motifs, 3D brand objects, product screens, deck or site imagery — into a page, deck, document or design; when an embedded RGC asset url 404s or renders the wrong image; or when asked what RGC brand assets exist."
license: MIT
compatibility: "Any agent that can make HTTPS requests. An MCP client is preferred and gives four tools over streamable HTTP; without one, the same data is a single JSON fetch. Nothing here needs authentication — the library is public."
metadata: "group=brand; lifecycle=release; version=1.0.0; author=crissmoldovan"
allowed-tools: Read Write Grep Glob Bash WebFetch
---

# RGC public assets

The Really Good Culture brand asset library: 936 files — logos, icons, motifs,
3D brand objects, image fills, deck artwork, product screens, boards and site
imagery — served from a CDN.

**Core principle: resolve fresh, embed pinned.**

## The rule that matters

**Every asset url you emit must contain a 40-character commit SHA. Never a
branch.**

```
NO   https://cdn.jsdelivr.net/gh/RGC-LABS/rgc-public-assets@main/public/assets/logos/rgc-mark.png
YES  https://cdn.jsdelivr.net/gh/RGC-LABS/rgc-public-assets@1c9a2e8cee2da5902d03c26231e8931a080b3139/public/assets/logos/rgc-mark.png
```

A branch is a moving pointer. Anything built against one renders correctly today
and silently breaks — wrong crop, wrong lockup, or a 404 — the first time that
asset is re-exported. A commit SHA is immutable: the bytes behind it can never
change.

Pins are **per file**. An asset's url is built from the commit that last modified
*that file*, so unrelated commits never invalidate your links.

This is not a style preference. Shortening a long pinned url to `main` is a
defect, not a cleanup.

## Reaching the library

**With MCP (preferred).** Endpoint, no authentication:

```
https://assets.public.rgclabs.dev/mcp
```

| Tool | Use it for |
|---|---|
| `search_assets` | Find assets by filename or path, optionally inside one category. |
| `get_asset` | One asset by exact path, with dimensions, provenance and pinned urls. |
| `list_categories` | What categories exist and how many files each holds. |
| `check_pin` | Whether a url embedded earlier has gone stale. |

**Without MCP.** The same data is one fetch. This is the only thing you ever
request from a branch — it is the mutable entry point, deliberately, so you always
discover the current set:

```bash
curl -s https://raw.githubusercontent.com/RGC-LABS/rgc-public-assets/main/assets.json
```

## Resolving an asset

1. Search, or fetch the manifest.
2. Find the entry you want.
3. Use its `url` **verbatim**. It is already pinned.

An entry carries everything needed to embed and later re-check it:

```json
{
  "path": "logos/rgc-logo.svg",
  "category": "logos",
  "bytes": 24321,
  "dimensions": "711x306",
  "content_id": "54aa97ec3d3368cab2def51411053af531d8a16e",
  "commit": "1c9a2e8cee2da5902d03c26231e8931a080b3139",
  "modified": "2026-08-26",
  "author": "Criss Moldovan",
  "url": "https://cdn.jsdelivr.net/gh/RGC-LABS/rgc-public-assets@1c9a2e8.../public/assets/logos/rgc-logo.svg",
  "url_raw": "https://raw.githubusercontent.com/RGC-LABS/rgc-public-assets/1c9a2e8.../public/assets/logos/rgc-logo.svg",
  "thumb_url": "https://cdn.jsdelivr.net/gh/RGC-LABS/rgc-public-assets@d6e0698.../public/thumbs/logos/rgc-logo.svg"
}
```

- `url` — jsDelivr. **Use this one.** Served `cache-control: immutable`, cached a year.
- `url_raw` — same commit via raw.githubusercontent. Fallback only: served
  `max-age=300`, and GitHub does not intend raw for production traffic.
- `thumb_url` — a 400px webp for grids and pickers, pinned to its own commit.
- `content_id` — the git blob SHA. Identical bytes give an identical
  `content_id`, which is what makes staleness checkable.
- `path` is the stable identifier and stays the same across repo reorganisation.

## Checking a pin later

**Record `content_id` alongside every url you embed.** To check whether a pin has
gone stale, compare that `content_id` — do not silently re-resolve and swap the
url.

- **Unchanged** — the asset is byte-identical. The existing url is still correct.
  Leave it alone.
- **Changed** — the asset was genuinely re-exported. Review the new version, then
  update the pin deliberately.

Never auto-follow a change. A re-export can alter a crop, a lockup or a colourway,
and a page that silently adopts it is a page nobody reviewed.

## Categories

| Folder | What it holds |
|---|---|
| `logos` | RGC marks and product marks. `rgc-logo.svg` is the only vector logo. |
| `icons` | report-icons (dark/light pairs), mono icons using `currentColor`, dimension modules, shopper archetypes. |
| `motifs` | 3D brand objects for dark panels, and the three 3D product marks. |
| `image-fills` | Source bitmaps from the Figma file, at original resolution. |
| `backgrounds-extras` | Backgrounds and unmapped layer renders. |
| `deck` | The 45-section master pitch, blank slide templates, brand-pitch examples. |
| `screens` | The built product screens. |
| `boards` | One image per Figma branding board. |
| `site` | Site imagery: site-assets, article headers, LinkedIn sizes. |

## Brand rules

- **Logos are placed, never redrawn.** Do not recreate a mark in CSS, SVG paths
  or ASCII, do not recolour it, and do not rebuild a lockup from parts. Reference
  the file.
- **Every figure in example artwork is illustrative.** Numbers, charts and
  personas inside deck and screen images are examples, not data. Never cite them
  as fact or present them as real results.
- **Icons come in matched pairs.** `mono` icons inherit `currentColor`;
  report-icons ship as explicit dark/light pairs. Pick the pair that matches the
  surface rather than filtering one into the other.

## Common mistakes

| Mistake | What happens |
|---|---|
| Shortening a pinned url to `main` | Renders today, breaks at the next re-export. |
| Pinning the manifest fetch | You stop discovering new assets. Fetch it from `main`. |
| Re-resolving instead of checking `content_id` | You adopt an unreviewed re-export. |
| Using `url_raw` in production | `max-age=300`, and not intended for that traffic. |
| Redrawing a logo because the file "looks simple" | An off-brand mark that reads as genuine. |
| Quoting a number from a deck image | Presenting illustrative artwork as real data. |

## Quick reference

| I want to… | Do this |
|---|---|
| Find artwork | `search_assets`, or filter `assets.json` on `path` |
| Get one file | `get_asset` with the exact `path` |
| See what exists | `list_categories` |
| Know if my url is stale | `check_pin` with the stored `content_id` |
| Embed it | Copy `url` verbatim; store `content_id` beside it |
| Browse visually | https://assets.public.rgclabs.dev — password-protected, RGC only |

Full agent-facing notes: https://assets.public.rgclabs.dev/llms.txt

The assets, the manifest, `llms.txt` and the MCP endpoint are all public and need
no credentials. Only the visual browser is password-protected.
