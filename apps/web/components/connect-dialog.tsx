"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Chip,
  CopyButton,
  Dialog,
  Panel,
  PanelHeader,
  Select,
  Separator,
} from "@rgc-labs/ui";
import { Plug } from "lucide-react";

type Step = { text: string; code?: string };
type Client = { value: string; label: string; steps: Step[]; note?: string };

const clients = (url: string): Client[] => [
  {
    value: "claude-code",
    label: "Claude Code",
    steps: [
      { text: "Run this in your terminal:", code: `claude mcp add --transport http rgc-assets ${url}` },
      { text: "Confirm it connected:", code: "/mcp" },
    ],
  },
  {
    value: "claude-desktop",
    label: "Claude Desktop",
    steps: [
      { text: "Settings → Connectors → Add custom connector." },
      { text: "Paste this as the server URL:", code: url },
      { text: "Save, then enable the connector in a new chat." },
    ],
    note: "Custom connectors need a Pro, Max, Team or Enterprise plan.",
  },
  {
    value: "cursor",
    label: "Cursor",
    steps: [
      {
        text: "Add to ~/.cursor/mcp.json (all projects) or .cursor/mcp.json (this project):",
        code: JSON.stringify({ mcpServers: { "rgc-assets": { url } } }, null, 2),
      },
      { text: "Settings → MCP, and confirm rgc-assets is enabled." },
    ],
  },
  {
    value: "vscode",
    label: "VS Code (Copilot)",
    steps: [
      {
        text: "Add to .vscode/mcp.json in your workspace:",
        code: JSON.stringify({ servers: { "rgc-assets": { type: "http", url } } }, null, 2),
      },
      { text: "Open Chat in Agent mode and pick the tools from the toolbar." },
    ],
  },
  {
    value: "windsurf",
    label: "Windsurf",
    steps: [
      {
        text: "Add to ~/.codeium/windsurf/mcp_config.json:",
        code: JSON.stringify({ mcpServers: { "rgc-assets": { serverUrl: url } } }, null, 2),
      },
      { text: "Cascade → MCP panel → Refresh." },
    ],
  },
  {
    value: "chatgpt",
    label: "ChatGPT",
    steps: [
      { text: "Settings → Connectors → Advanced → enable Developer mode." },
      { text: "Create a connector with this MCP server URL:", code: url },
    ],
    note: "Developer mode availability depends on your ChatGPT plan.",
  },
  {
    value: "other",
    label: "Anything else",
    steps: [
      { text: "Point any MCP client at this endpoint over streamable HTTP:", code: url },
      { text: "No authentication — the asset library is public." },
    ],
  },
];

const PROMPT = `You have access to the RGC brand asset library through the rgc-assets MCP server.

Use search_assets to find artwork, get_asset to fetch one file by path, and list_categories to see what exists.

Every url these tools return is pinned to a commit and is safe to embed permanently. Copy urls verbatim — never replace the commit SHA with "main". A branch ref is mutable, so anything built against one renders correctly today and silently breaks the next time that asset is re-exported.

When you embed an asset, record its content_id alongside the url. To check later whether the pin is stale, call check_pin with that content_id rather than re-resolving: unchanged means the file is byte-identical and the existing url must be left alone.

Logos are placed, never redrawn or recoloured. Every figure in deck and screen artwork is illustrative — never cite those numbers as real data.`;

function Code({ value }: { value: string }) {
  return (
    <div className="flex items-start gap-(--rgc-space-2)">
      <pre className="min-w-0 flex-1 overflow-x-auto rounded-(--radius-control) bg-surface-2 p-(--rgc-space-3) font-mono text-(length:--rgc-text-micro) text-fg">
        {value}
      </pre>
      <CopyButton value={value}>Copy</CopyButton>
    </div>
  );
}

export function ConnectDialog() {
  const [url, setUrl] = useState("");
  const [client, setClient] = useState("claude-code");

  // The endpoint follows wherever this is deployed, so the instructions stay
  // correct on a preview url and on the custom domain alike.
  useEffect(() => setUrl(`${window.location.origin}/mcp`), []);

  const all = clients(url || "…");
  const active = all.find((c) => c.value === client) ?? all[0];

  return (
    <Dialog.Root>
      <Dialog.Trigger
        render={<Button icon={Plug} size="sm" variant="secondary">Connect to agent</Button>}
      />
      <Dialog.Content width="lg">
        <Dialog.Title>Connect an agent</Dialog.Title>
        <Dialog.Description>
          This library is an MCP server. Point an agent at it and it can search the
          assets and hand back commit-pinned urls that will not break.
        </Dialog.Description>

        <div className="flex flex-col gap-(--rgc-space-4)">
          <Panel>
            <PanelHeader
              title="Endpoint"
              actions={<Chip tone="ok">no auth</Chip>}
            />
            <div className="p-(--rgc-space-3)">
              <Code value={url || "…"} />
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Set up your client"
              actions={
                <Select
                  items={all.map((c) => ({ value: c.value, label: c.label }))}
                  value={client}
                  onValueChange={(v) => setClient(v ?? "claude-code")}
                  aria-label="Choose your MCP client"
                  size="sm"
                />
              }
            />
            <ol className="flex flex-col gap-(--rgc-space-3) p-(--rgc-space-3)">
              {active.steps.map((s, i) => (
                <li key={i} className="flex flex-col gap-(--rgc-space-2)">
                  <span className="text-(length:--rgc-text-ui) text-fg">
                    <span className="text-fg-subtle tabular-nums">{i + 1}. </span>
                    {s.text}
                  </span>
                  {s.code ? <Code value={s.code} /> : null}
                </li>
              ))}
            </ol>
            {active.note ? (
              <>
                <Separator />
                <p className="p-(--rgc-space-3) text-(length:--rgc-text-micro) text-fg-subtle">
                  {active.note}
                </p>
              </>
            ) : null}
          </Panel>

          <Panel>
            <PanelHeader title="Then tell your agent this" />
            <div className="p-(--rgc-space-3)">
              <p className="pb-(--rgc-space-2) text-(length:--rgc-text-micro) text-fg-subtle">
                Paste this once so it knows the rules. The server also sends them on
                connect, but a client that ignores instructions still gets them here.
              </p>
              <Code value={PROMPT} />
            </div>
          </Panel>
        </div>

        <Dialog.Footer>
          <Dialog.Close render={<Button variant="ghost">Done</Button>} />
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
