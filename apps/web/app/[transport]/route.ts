import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  type Asset,
  assets,
  categories,
  head,
  humanBytes,
  pinnedRawUrl,
  pinnedUrl,
  repo,
  thumbUrl,
} from "../../lib/assets";

const PIN_NOTE =
  "This url is pinned to the commit that last modified this file and is safe to " +
  "embed permanently. Never rewrite it to point at a branch such as main: a branch " +
  "ref is mutable, so anything built against one breaks when the asset is re-exported.";

const describe = (a: Asset) => ({
  path: a.path,
  category: a.category,
  bytes: a.bytes,
  size: humanBytes(a.bytes),
  dimensions: a.dimensions || null,
  modified: a.modified,
  author: a.author,
  content_id: a.contentId,
  commit: a.commit,
  url: pinnedUrl(a),
  url_raw: pinnedRawUrl(a),
  thumb_url: thumbUrl(a),
});

const json = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 1) }],
});

/** Rank by how early and how exactly the query lands, so "logo" finds the logos. */
function search(query: string, category: string | undefined, limit: number) {
  const q = query.trim().toLowerCase();
  const pool = category ? assets.filter((a) => a.category === category) : assets;
  if (!q) return pool.slice(0, limit);

  return pool
    .map((a) => {
      const name = a.name.toLowerCase();
      const path = a.path.toLowerCase();
      const score = name === q ? 0
        : name.replace(/\.[^.]+$/, "") === q ? 1
        : name.startsWith(q) ? 2
        : name.includes(q) ? 3
        : path.includes(q) ? 4
        : -1;
      return { a, score };
    })
    .filter((r) => r.score >= 0)
    .sort((x, y) => x.score - y.score || x.a.path.localeCompare(y.a.path))
    .slice(0, limit)
    .map((r) => r.a);
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "search_assets",
      {
        title: "Search assets",
        description:
          "Search the RGC brand asset library by filename or path. Returns matching " +
          "assets with commit-pinned urls that are safe to embed permanently.",
        inputSchema: {
          query: z.string().describe("Filename or path fragment, e.g. 'logo' or 'roas'."),
          category: z
            .enum(Object.keys(categories) as [string, ...string[]])
            .optional()
            .describe("Restrict to one category."),
          limit: z.number().int().min(1).max(100).default(20),
        },
      },
      async ({ query, category, limit }) => {
        const hits = search(query, category, limit);
        return json({
          query,
          category: category ?? null,
          count: hits.length,
          note: PIN_NOTE,
          assets: hits.map(describe),
        });
      },
    );

    server.registerTool(
      "get_asset",
      {
        title: "Get asset",
        description:
          "Get one asset by its exact path (e.g. 'logos/rgc-logo.svg'), with its " +
          "commit-pinned urls and full provenance.",
        inputSchema: { path: z.string().describe("Exact asset path, as returned by search_assets.") },
      },
      async ({ path }) => {
        const a = assets.find((x) => x.path === path)
          ?? assets.find((x) => x.path.toLowerCase() === path.toLowerCase());
        if (!a) {
          const near = search(path.split("/").pop() ?? path, undefined, 5).map((x) => x.path);
          return json({ error: `No asset at '${path}'.`, did_you_mean: near });
        }
        return json({ note: PIN_NOTE, ...describe(a) });
      },
    );

    server.registerTool(
      "list_categories",
      {
        title: "List categories",
        description: "List the asset categories and how many files each holds.",
        inputSchema: {},
      },
      async () =>
        json({
          repo,
          index_commit: head,
          total: assets.length,
          categories: Object.entries(categories).map(([name, count]) => ({ name, count })),
        }),
    );

    server.registerTool(
      "check_pin",
      {
        title: "Check whether a pinned asset is stale",
        description:
          "Given an asset path and the content_id you stored when you pinned it, report " +
          "whether the file has actually changed since. Unchanged means your existing " +
          "pinned url is still correct and must not be updated.",
        inputSchema: {
          path: z.string(),
          content_id: z.string().describe("The content_id recorded when the url was pinned."),
        },
      },
      async ({ path, content_id }) => {
        const a = assets.find((x) => x.path === path);
        if (!a) return json({ error: `No asset at '${path}'. It may have been removed or renamed.` });
        const changed = a.contentId !== content_id;
        return json({
          path,
          changed,
          verdict: changed
            ? "The bytes changed. Review the new version, then update your pin deliberately."
            : "Byte-identical. Your existing pinned url is still correct — do not change it.",
          current: changed ? describe(a) : undefined,
        });
      },
    );
  },
  {
    // Sent to every client on connect, so the rule cannot be missed.
    instructions:
      "The RGC brand asset library. Every url these tools return is pinned to the commit " +
      "that last modified that file, and is safe to embed permanently.\n\n" +
      "NEVER rewrite a returned url to point at a branch (e.g. replacing the 40-character " +
      "commit SHA with 'main'). A branch ref is mutable: anything built against one renders " +
      "correctly today and silently breaks the next time that asset is re-exported. Copy " +
      "urls verbatim.\n\n" +
      "Record the content_id alongside any url you embed. To check later whether a pin is " +
      "stale, call check_pin rather than re-resolving: if the content_id is unchanged the " +
      "asset is byte-identical and the existing url must be left alone.\n\n" +
      "Brand rules: logos are placed, never redrawn or recoloured. Every figure in deck and " +
      "screen artwork is illustrative — never cite those numbers as real data.",
  },
  { basePath: "/", disableSse: true, maxDuration: 60 },
);

export { handler as GET, handler as POST };
