import manifest from "../data/manifest.json";

export type Asset = {
  path: string;
  name: string;
  category: string;
  bytes: number;
  dimensions: string;
  commit: string;
  thumbCommit: string | null;
  modified: string;
  author: string;
  contentId: string;
};

type Row = [string, string, number, string, string, string | null, string, string, string];

const fill = (tpl: string, commit: string, path: string) =>
  tpl
    .replace("{slug}", manifest.repo)
    .replace("{commit}", commit)
    .replace("{path}", encodeURI(path));

/**
 * Every url this module produces carries a commit SHA. There is deliberately no
 * branch-based variant: a branch ref is mutable, so anything built against one
 * breaks the next time an asset is re-exported. See llms.txt at the repo root.
 */
export const pinnedUrl = (a: Asset) =>
  fill(manifest.cdn, a.commit, `${manifest.assets_dir}/${a.path}`);

export const pinnedRawUrl = (a: Asset) =>
  fill(manifest.raw, a.commit, `${manifest.assets_dir}/${a.path}`);

export const thumbUrl = (a: Asset) => {
  if (a.path.endsWith(".svg")) return pinnedUrl(a);
  if (!a.thumbCommit) return null;
  const stem = a.path.replace(/\.[^.]+$/, "");
  return fill(manifest.cdn, a.thumbCommit, `${manifest.thumbs_dir}/${stem}.webp`);
};

export const isImage = (p: string) =>
  /\.(png|jpe?g|webp|gif|svg|tiff?)$/i.test(p);

export const humanBytes = (n: number) =>
  n < 1024 ? `${n} B`
  : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB`
  : `${(n / 1024 ** 2).toFixed(1)} MB`;

export const assets: Asset[] = (manifest.assets as Row[]).map((r) => ({
  path: r[0],
  name: r[0].split("/").pop() ?? r[0],
  category: r[1],
  bytes: r[2],
  dimensions: r[3],
  commit: r[4],
  thumbCommit: r[5],
  modified: r[6],
  author: r[7],
  contentId: r[8],
}));

export const categories = manifest.categories as Record<string, number>;
export const repo = manifest.repo;
export const head = manifest.head;
export const totalBytes = assets.reduce((n, a) => n + a.bytes, 0);
