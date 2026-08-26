#!/usr/bin/env python3
"""Generate grid thumbnails for the asset browser.

Usage: python3 tools/build-thumbs.py <assets-dir> [--size 400] [--force]

Reads public/assets/, writes public/thumbs/<same-relative-path>.webp for
every raster asset. SVGs are
skipped -- they are vector and already small, so the browser uses the original.

Thumbnails are committed to the repo so they get pinned commit urls like any
other asset, and so the grid costs nothing to serve. The detail panel uses the
full-resolution original through Vercel's image optimizer instead.

Skips any thumbnail newer than its source; --force rebuilds everything.
"""
import os, sys

RASTER = (".png", ".jpg", ".jpeg", ".webp", ".gif", ".tif", ".tiff")
ASSETS_DIR = "public/assets"
THUMBS_DIR = "public/thumbs"


def main():
    args = sys.argv[1:]
    if not args: sys.exit(__doc__)
    root = os.path.abspath(args[0])
    size = int(args[args.index("--size") + 1]) if "--size" in args else 400
    force = "--force" in args

    from PIL import Image
    Image.MAX_IMAGE_PIXELS = None

    made = skipped = failed = 0
    assets_root = os.path.join(root, ASSETS_DIR)
    if not os.path.isdir(assets_root): sys.exit(f"no {ASSETS_DIR}/ under {root}")

    for dp, dns, fns in os.walk(assets_root):
        dns[:] = sorted(d for d in dns if not d.startswith("."))
        for fn in sorted(fns):
            if fn.startswith(".") or os.path.splitext(fn)[1].lower() not in RASTER: continue
            src = os.path.join(dp, fn)
            rel = os.path.relpath(src, assets_root).replace(os.sep, "/")
            dst = os.path.join(root, THUMBS_DIR, os.path.splitext(rel)[0] + ".webp")
            if not force and os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
                skipped += 1; continue
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            try:
                with Image.open(src) as im:
                    im = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB")
                    im.thumbnail((size, size), Image.LANCZOS)
                    im.save(dst, "WEBP", quality=72, method=4)
                made += 1
            except Exception as ex:
                failed += 1
                print(f"  failed {rel}: {ex}", file=sys.stderr)
            if (made + skipped) % 200 == 0 and made:
                print(f"  ...{made + skipped} processed", flush=True)

    total = sum(os.path.getsize(os.path.join(d, f))
                for d, _, fs in os.walk(os.path.join(root, THUMBS_DIR)) for f in fs)
    print(f"thumbs: {made} built, {skipped} up to date, {failed} failed, {total / 1024 / 1024:.1f}MB total")


if __name__ == "__main__":
    main()
