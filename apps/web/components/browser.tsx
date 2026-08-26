"use client";

import { useMemo, useState } from "react";
import {
  AppShell,
  Chip,
  CopyButton,
  DescriptionList,
  EmptyState,
  Eyebrow,
  Grid,
  Panel,
  PanelHeader,
  Row,
  SearchInput,
  Separator,
  Sidebar,
  Stack,
  StatusBar,
  TitleBar,
} from "@rgc-labs/ui";
import {
  Box,
  FileQuestion,
  Globe,
  ImageIcon,
  Layers,
  LayoutGrid,
  Library,
  Monitor,
  Presentation,
  SearchX,
  Shapes,
  Stamp,
} from "lucide-react";
import {
  type Asset,
  humanBytes,
  isImage,
  pinnedRawUrl,
  pinnedUrl,
  thumbUrl,
} from "../lib/assets";

const CATEGORY_ICON: Record<string, React.ElementType> = {
  logos: Stamp,
  icons: Shapes,
  motifs: Box,
  "image-fills": ImageIcon,
  "backgrounds-extras": Layers,
  deck: Presentation,
  screens: Monitor,
  boards: LayoutGrid,
  site: Globe,
};

type Props = {
  assets: Asset[];
  categories: Record<string, number>;
  repo: string;
  head: string;
  totalBytes: number;
};

export function Browser({ assets, categories, repo, head, totalBytes }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<Asset | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter(
      (a) =>
        (!category || a.category === category) &&
        (!q || a.path.toLowerCase().includes(q)),
    );
  }, [assets, query, category]);

  return (
    <AppShell.Root>
      <TitleBar
        center="Asset Library"
        actions={<Chip tone="ok">{assets.length} files</Chip>}
      >
        <AppShell.NavTrigger />
        <Eyebrow>RGC LABS</Eyebrow>
      </TitleBar>

      <AppShell.Body>
        <AppShell.Sidebar aria-label="Categories" drawerTitle="Categories">
          <Sidebar.Section label="Library">
            <Sidebar.Item
              icon={Library}
              active={category === null}
              onClick={() => setCategory(null)}
              badge={<Chip>{assets.length}</Chip>}
            >
              All assets
            </Sidebar.Item>
          </Sidebar.Section>
          <Sidebar.Section label="Categories">
            {Object.entries(categories).map(([name, count]) => (
              <Sidebar.Item
                key={name}
                icon={CATEGORY_ICON[name] ?? FileQuestion}
                active={category === name}
                onClick={() => setCategory(name)}
                badge={<Chip>{count}</Chip>}
              >
                {name}
              </Sidebar.Item>
            ))}
          </Sidebar.Section>
        </AppShell.Sidebar>

        <AppShell.Content>
          <div className="flex items-center gap-(--rgc-space-3) border-b border-border px-(--rgc-space-4) py-(--rgc-space-2)">
            <SearchInput
              value={query}
              onValueChange={setQuery}
              placeholder="Filter by name or path…"
              aria-label="Filter assets"
              className="max-w-120"
            />
            <span className="ml-auto text-(length:--rgc-text-micro) text-fg-subtle tabular-nums">
              {shown.length === assets.length
                ? `${assets.length} files`
                : `${shown.length} of ${assets.length}`}
            </span>
          </div>

          <AppShell.Scroller>
            {shown.length === 0 ? (
              <div className="p-(--rgc-space-6)">
                <EmptyState
                  icon={SearchX}
                  title="Nothing matches that filter"
                  hint="Try a shorter query, or clear the category."
                />
              </div>
            ) : (
              <div className="p-(--rgc-space-4)">
                <Grid minItemWidth="11rem" gap={4}>
                  {shown.map((a) => (
                    <AssetTile
                      key={a.path}
                      asset={a}
                      selected={selected?.path === a.path}
                      onSelect={() => setSelected(a)}
                    />
                  ))}
                </Grid>
              </div>
            )}
          </AppShell.Scroller>
        </AppShell.Content>

        {selected ? (
          <AppShell.Aside aria-label="Asset details">
            <Detail asset={selected} onClose={() => setSelected(null)} />
          </AppShell.Aside>
        ) : null}
      </AppShell.Body>

      <StatusBar>
        <StatusBar.Item tone="ok">{repo}</StatusBar.Item>
        <StatusBar.Item>{humanBytes(totalBytes)}</StatusBar.Item>
        <StatusBar.Item push>index {head.slice(0, 7)}</StatusBar.Item>
      </StatusBar>
    </AppShell.Root>
  );
}

function AssetTile({
  asset,
  selected,
  onSelect,
}: {
  asset: Asset;
  selected: boolean;
  onSelect: () => void;
}) {
  const thumb = thumbUrl(asset);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="group flex flex-col gap-(--rgc-space-2) rounded-(--radius-surface) border border-border bg-surface-1 p-(--rgc-space-2) text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent aria-pressed:border-accent"
    >
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-(--radius-control) bg-surface-2">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- pre-generated 400px webp, already the right size
          <img
            src={thumb}
            alt=""
            loading="lazy"
            decoding="async"
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <FileQuestion className="size-icon-md text-fg-subtle" aria-hidden />
        )}
      </div>
      <span className="truncate text-(length:--rgc-text-micro) text-fg" title={asset.name}>
        {asset.name}
      </span>
      <span className="text-(length:--rgc-text-micro) text-fg-subtle tabular-nums">
        {asset.dimensions || "—"} · {humanBytes(asset.bytes)}
      </span>
    </button>
  );
}

function Detail({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const url = pinnedUrl(asset);
  const raw = pinnedRawUrl(asset);
  const thumb = thumbUrl(asset);

  return (
    <Stack gap={4} className="p-(--rgc-space-4)">
      <Panel>
        <PanelHeader
          title={asset.name}
          actions={<Chip tone="accent">{asset.category}</Chip>}
        />
        <div className="flex items-center justify-center bg-surface-2 p-(--rgc-space-4)">
          {isImage(asset.path) && thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- pinned CDN url, intrinsically sized
            <img
              src={thumb}
              alt={asset.name}
              className="max-h-80 max-w-full object-contain"
            />
          ) : (
            <FileQuestion className="size-icon-md text-fg-subtle" aria-hidden />
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Details" />
        <DescriptionList.Root>
          <DescriptionList.Term>Path</DescriptionList.Term>
          <DescriptionList.Detail>
            <span className="font-mono text-(length:--rgc-text-micro)">{asset.path}</span>
          </DescriptionList.Detail>

          <DescriptionList.Term>Dimensions</DescriptionList.Term>
          <DescriptionList.Detail>{asset.dimensions || "—"}</DescriptionList.Detail>

          <DescriptionList.Term>Size</DescriptionList.Term>
          <DescriptionList.Detail>{humanBytes(asset.bytes)}</DescriptionList.Detail>

          <DescriptionList.Term>Modified</DescriptionList.Term>
          <DescriptionList.Detail>{asset.modified}</DescriptionList.Detail>

          <DescriptionList.Term>By</DescriptionList.Term>
          <DescriptionList.Detail>{asset.author}</DescriptionList.Detail>

          <DescriptionList.Term>Content id</DescriptionList.Term>
          <DescriptionList.Detail>
            <span className="font-mono text-(length:--rgc-text-micro) text-fg-muted">
              {asset.contentId.slice(0, 12)}
            </span>
          </DescriptionList.Detail>
        </DescriptionList.Root>
      </Panel>

      <Panel>
        <PanelHeader
          title="Pinned links"
          actions={<Chip tone="ok">commit {asset.commit.slice(0, 7)}</Chip>}
        />
        <Row>
          <span className="text-(length:--rgc-text-micro) text-fg-muted">
            Every url below is pinned to the commit that last changed this file, so it is
            safe to embed permanently. Do not rewrite one to point at a branch.
          </span>
        </Row>
        <Separator />
        <CopyRow label="CDN url" value={url} hint="jsDelivr · immutable, cached a year" />
        <CopyRow label="raw url" value={raw} hint="GitHub raw · fallback only" />
        <CopyRow label="Markdown" value={`![${asset.name}](${url})`} />
        <CopyRow label="HTML" value={`<img src="${url}" alt="${asset.name}" />`} />
      </Panel>

      <Row interactive onClick={onClose}>
        Close
      </Row>
    </Stack>
  );
}

function CopyRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Row>
      <div className="flex min-w-0 flex-col gap-(--rgc-space-1)">
        <span className="text-(length:--rgc-text-label) text-fg">{label}</span>
        <span className="truncate font-mono text-(length:--rgc-text-micro) text-fg-subtle">
          {value}
        </span>
        {hint ? (
          <span className="text-(length:--rgc-text-micro) text-fg-subtle">{hint}</span>
        ) : null}
      </div>
      <span className="ml-auto shrink-0 pl-(--rgc-space-2)">
        <CopyButton value={value}>Copy</CopyButton>
      </span>
    </Row>
  );
}
