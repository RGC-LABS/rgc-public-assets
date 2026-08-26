# RGC Public Assets

The Really Good Culture brand asset library — logos, icons, motifs, 3D brand
objects, deck artwork, product screens and site imagery — served over a CDN with
**commit-pinned urls that never break**.

- **Browse:** https://assets.public.rgclabs.dev
- **For agents:** [llms.txt](llms.txt) · **MCP:** `https://assets.public.rgclabs.dev/mcp`
- **Catalogue:** [ASSET-INDEX.md](ASSET-INDEX.md) · **Manifest:** [assets.json](assets.json)

## The one rule

**Every asset url must contain a 40-character commit SHA. Never `main`.**

```
NO   https://cdn.jsdelivr.net/gh/RGC-LABS/rgc-public-assets@main/public/assets/logos/rgc-mark.png
YES  https://cdn.jsdelivr.net/gh/RGC-LABS/rgc-public-assets@1c9a2e8…/public/assets/logos/rgc-mark.png
```

`main` is a moving pointer. A deck or landing page built against it renders
correctly today and silently breaks — wrong crop, wrong lockup, or a 404 — the
first time someone re-exports that asset. A commit SHA is immutable.

Pins are **per file**, not per repo: an asset's url is built from the commit that
last modified *that file*, so it only changes when the asset itself changes.
Unrelated commits never invalidate your links.

## Resolving an asset

1. Fetch [`assets.json`](assets.json) from `main` — the mutable entry point, so
   you always discover the current set.
2. Find the entry you want.
3. Use its `url` verbatim. It is already pinned.

*Resolve fresh, embed pinned.* Store the `content_id` alongside anything you
embed; to check staleness later, compare `content_id` rather than re-resolving.
Unchanged means byte-identical — leave your url alone.

`url` is jsDelivr (`immutable`, cached a year) and is the one to use. `url_raw`
is the same commit via raw.githubusercontent, which GitHub serves `max-age=300`
and does not intend for production traffic — fallback only.

## Agent skill

Teach an agent the rules above once, instead of restating them every session:

```bash
npx skills add RGC-LABS/public-assets
```

Source: [RGC-LABS/public-assets](https://github.com/RGC-LABS/public-assets). It
lives in its own repository because the `skills` CLI clones the whole repo to
install a skill, and this one is ~620MB.

Pair it with the MCP server at `https://assets.public.rgclabs.dev/mcp`, which
gives the agent `search_assets`, `get_asset`, `list_categories` and `check_pin`.

## Layout

| Path | |
|---|---|
| `public/assets/` | The assets: `logos`, `icons`, `motifs`, `image-fills`, `backgrounds-extras`, `deck`, `screens`, `boards`, `site` |
| `public/thumbs/` | 400px webp thumbnails mirroring the same tree |
| `apps/web/` | The browser and MCP server (Next.js + `@rgc-labs/ui`) |
| `tools/` | The index and thumbnail generators |

## Regenerating

`ASSET-INDEX.md`, `assets.json` and `apps/web/data/manifest.json` are generated.
Commit new assets **first** — pinning reads git history — then:

```bash
python3 tools/build-thumbs.py .        # only rebuilds changed files
python3 tools/build-asset-index.py .
```

The indexer refuses to emit an unpinned url and warns about anything not yet
committed. Pushing to `main` redeploys the browser and MCP server.

## Brand rules

- **Logos are placed, never redrawn.** Do not recreate a mark in CSS or SVG
  paths, recolour it, or rebuild a lockup from parts.
- **Every figure in example artwork is illustrative.** Numbers and charts inside
  deck and screen images are examples, never real results — do not cite them.

## Building the app

`apps/web` depends on `@rgc-labs/ui`, which is published to GitHub Packages and
is **internal to RGC Labs**. Building it needs a classic GitHub PAT with
`read:packages`:

```bash
npm config set //npm.pkg.github.com/:_authToken ghp_…
cd apps/web && npm install && npm run dev
```

The assets and the tooling in this repo need none of that.
