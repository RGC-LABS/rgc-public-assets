#!/usr/bin/env python3
"""Build ASSET-INDEX.md + assets.json for the RGC public asset library.

Usage:
  python3 tools/build-asset-index.py <assets-dir> [--map map.json] [--base-url URL]

DEFAULT (git checkout with a GitHub remote): every asset is given a
COMMIT-PINNED url. The commit is the one that last touched THAT FILE -- not
HEAD -- so an asset's url only changes when the asset itself changes, and two
consumers who grab an unchanged file months apart get the same url and the
same CDN cache entry.

Pinned urls are the only urls this script emits. There is deliberately no mode
that produces a `main`-based url: a branch ref is mutable, so anything built
against one silently breaks the next time this repo is updated.

  primary   https://cdn.jsdelivr.net/gh/<owner>/<repo>@<commit>/<path>
            cache-control: max-age=31536000, immutable  (a real CDN)
  fallback  https://raw.githubusercontent.com/<owner>/<repo>/<commit>/<path>
            cache-control: max-age=300, and not intended for production traffic

Legacy modes, kept for the Google Drive workflow (Drive does not preserve
folder paths in file urls, so a base url cannot work there -- upload, export a
map from the Drive listing, re-run with --map):
  --map map.json   {"<relative-path-or-filename>": "<url>", ...}
  --base-url URL   URL + "/" + relative path, for path-preserving hosts

Dimensions are cached in the previous assets.json by content id, so re-runs
only re-measure files whose bytes actually changed.

Re-run after any change to the assets folder; the outputs are generated files.
"""
import os, sys, json, re, subprocess, urllib.parse

CDN = "https://cdn.jsdelivr.net/gh/{slug}@{commit}/{path}"
RAW = "https://raw.githubusercontent.com/{slug}/{commit}/{path}"

IMG_EXT = (".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".tif", ".tiff")

ASSETS_DIR = "public/assets"   # assets live here; urls are repo-relative, paths are not
THUMBS_DIR = "public/thumbs"


def git(root, *a):
    r = subprocess.run(("git", "-c", "core.quotepath=false", "-C", root) + a,
                       capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else None


def repo_slug(root):
    url = git(root, "remote", "get-url", "origin")
    if not url: return None
    m = re.search(r"github\.com[:/](.+?)(?:\.git)?\s*$", url.strip())
    return m.group(1) if m else None


def last_touched(root):
    """path -> (commit, iso_date, author_name, author_email) for the newest commit touching it."""
    out = git(root, "log", "--format=\x01%H\t%aI\t%an\t%ae", "--name-only", "--no-renames")
    meta, cur = {}, None
    for line in (out or "").splitlines():
        if line.startswith("\x01"):
            cur = tuple(line[1:].split("\t"))
        elif line and cur:
            meta.setdefault(line, cur)          # log is newest-first: first hit wins
    return meta


def blob_ids(root):
    """path -> git blob sha. Content identity: changes iff the bytes change."""
    out = git(root, "ls-tree", "-r", "HEAD")
    ids = {}
    for line in (out or "").splitlines():
        info, _, path = line.partition("\t")
        parts = info.split()
        if len(parts) == 3 and parts[1] == "blob": ids[path] = parts[2]
    return ids


def dims(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == ".svg":
        try:
            head = open(path, "r", errors="ignore").read(2048)
            m = re.search(r'viewBox="[\d.\s-]*?([\d.]+)\s+([\d.]+)"', head)
            if m: return f"{round(float(m.group(1)))}x{round(float(m.group(2)))}"
            w = re.search(r'width="([\d.]+)', head); h = re.search(r'height="([\d.]+)', head)
            if w and h: return f"{round(float(w.group(1)))}x{round(float(h.group(1)))}"
        except Exception: pass
        return "vector"
    try:
        from PIL import Image
        Image.MAX_IMAGE_PIXELS = None
        with Image.open(path) as im: return f"{im.width}x{im.height}"
    except Exception:
        return ""


def human(n):
    for u in ("B", "KB", "MB"):
        if n < 1024 or u == "MB": return f"{n}B" if u == "B" else f"{n:.1f}{u}"
        n /= 1024


BLURB = {
    "logos": "RGC marks and product marks. `rgc-logo.svg` is the only vector logo; place, never redraw.",
    "icons": "report-icons (156, dark/light pairs, slug names) + mono (78, currentColor) + the seven dimension modules (3D and colour) + 10 shopper archetypes.",
    "image-fills": "The source bitmaps embedded in the Figma file, at original resolution, plus the two gradient backgrounds.",
    "motifs": "3D brand objects for dark panels, and the three 3D product marks.",
    "backgrounds-extras": "Backgrounds and unmapped layer renders kept from the Figma file.",
    "deck": "The 45-section master pitch (47 PNGs), the 34 blank slide templates, and the brand-pitch example slides.",
    "screens": "The 10 built product screens.",
    "boards": "One PNG per Figma branding board; the completeness check.",
    "site": "Site imagery: site-assets, article headers, LinkedIn artwork sizes.",
}


def main():
    args = sys.argv[1:]
    if not args: sys.exit(__doc__)
    root = os.path.abspath(args[0])
    base = args[args.index("--base-url") + 1].rstrip("/") if "--base-url" in args else None
    linkmap = json.load(open(args[args.index("--map") + 1])) if "--map" in args else {}

    slug, meta, blobs = repo_slug(root), last_touched(root), blob_ids(root)
    head = (git(root, "rev-parse", "HEAD") or "").strip() or None
    if not slug and not base and not linkmap:
        sys.exit("no github remote and no --map/--base-url: refusing to emit unpinned urls")

    cache = {}
    try:
        prev = json.load(open(os.path.join(root, "assets.json")))
        cache = {a["content_id"]: a.get("dimensions", "") for a in prev.get("assets", [])
                 if a.get("content_id")}
    except Exception: pass

    assets_root = os.path.join(root, ASSETS_DIR)
    if not os.path.isdir(assets_root):
        sys.exit(f"no {ASSETS_DIR}/ directory under {root}")

    entries, measured = [], 0
    for dp, dns, fns in os.walk(assets_root):
        dns[:] = sorted(d for d in dns if not d.startswith("."))
        for fn in sorted(fns):
            if fn.startswith("."): continue
            p = os.path.join(dp, fn)
            rel = os.path.relpath(p, assets_root).replace(os.sep, "/")
            repo_rel = f"{ASSETS_DIR}/{rel}"
            cid = blobs.get(repo_rel)
            if os.path.splitext(fn)[1].lower() not in IMG_EXT:
                d = ""
            elif cid and cid in cache:
                d = cache[cid]
            else:
                d = dims(p); measured += 1
            commit, date, author, email = meta.get(repo_rel, (None, None, None, None))
            quoted = urllib.parse.quote(repo_rel)
            e = {
                "path": rel,
                "repo_path": repo_rel,
                "category": rel.split("/")[0] if "/" in rel else "(root)",
                "bytes": os.path.getsize(p),
                "dimensions": d,
                "content_id": cid,
                "commit": commit,
                "modified": date,
                "author": author,
                "author_email": email,
            }
            if slug and commit:
                e["url"] = CDN.format(slug=slug, commit=commit, path=quoted)
                e["url_raw"] = RAW.format(slug=slug, commit=commit, path=quoted)
            else:
                e["url"] = linkmap.get(rel) or linkmap.get(fn) or f"{base}/{quoted}"

            thumb_rel = f"{THUMBS_DIR}/{os.path.splitext(rel)[0]}.webp"
            tcommit = (meta.get(thumb_rel) or (None,))[0]
            if slug and tcommit and os.path.exists(os.path.join(root, thumb_rel)):
                e["thumb_url"] = CDN.format(slug=slug, commit=tcommit,
                                            path=urllib.parse.quote(thumb_rel))
            elif os.path.splitext(fn)[1].lower() == ".svg":
                e["thumb_url"] = e["url"]          # vector: the original is already small
            entries.append(e)

    unpinned = [e for e in entries if slug and not e.get("commit")]

    with open(os.path.join(root, "assets.json"), "w") as f:
        json.dump({
            "repo": slug,
            "head": head,
            "count": len(entries),
            "pinning": {
                "rule": "Never request an asset by branch. Every url below is pinned to the "
                        "commit that last modified that file and is safe to embed permanently.",
                "cdn_template": CDN.format(slug=slug or "<owner>/<repo>", commit="<commit>", path="<path>"),
                "raw_template": RAW.format(slug=slug or "<owner>/<repo>", commit="<commit>", path="<path>"),
            },
            "assets": entries,
        }, f, indent=1)

    cats = {}
    for e in entries: cats.setdefault(e["category"], []).append(e)

    lines = ["# RGC Assets - reference index", "",
             f"{len(entries)} files. Generated by `tools/build-asset-index.py`; regenerate after any change.", ""]
    if slug:
        lines += ["**Every link here is pinned to the commit that last modified that file.** "
                  "Copy them verbatim. Do not rewrite a pinned url to point at `main` - a branch ref "
                  "is mutable, and anything built against one breaks the next time this repo changes. "
                  "See [llms.txt](llms.txt).", ""]
    lines += ["Usage rules live in the design system: `INDEX.md`, the skill's `references/`, and the "
              "standing rules in `foundations/board-guidance.md`. Logos are placed, never redrawn; "
              "every figure in example artwork is illustrative.", ""]
    for cat in sorted(cats):
        es = cats[cat]
        lines += [f"## {cat} ({len(es)})", ""]
        if cat in BLURB: lines += [BLURB[cat], ""]
        lines += ["| File | Dimensions | Size | Modified | Link |", "|---|---|---|---|---|"]
        for e in es:
            name = e["path"].split("/", 1)[1] if "/" in e["path"] else e["path"]
            when = (e["modified"] or "")[:10]
            lines.append(f"| {name} | {e['dimensions']} | {human(e['bytes'])} | {when} | [link]({e['url']}) |")
        lines.append("")
    with open(os.path.join(root, "ASSET-INDEX.md"), "w") as f:
        f.write("\n".join(lines))

    print(f"indexed {len(entries)} files ({measured} re-measured) -> ASSET-INDEX.md, assets.json")
    if slug: print(f"pinned against {slug}, head {head[:7] if head else '?'}")
    if unpinned:
        print(f"WARNING: {len(unpinned)} file(s) not in git yet, so unpinnable - commit them, then re-run:")
        for e in unpinned[:10]: print(f"  {e['path']}")


if __name__ == "__main__":
    main()
