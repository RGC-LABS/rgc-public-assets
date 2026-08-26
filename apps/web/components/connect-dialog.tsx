"use client";

import { Fragment, useEffect, useState } from "react";
import {
  Button,
  Chip,
  CopyButton,
  DescriptionList,
  Dialog,
  Panel,
  PanelHeader,
  SegmentedControl,
  Select,
  Separator,
  Stepper,
} from "@rgc-labs/ui";
import { Plug } from "lucide-react";

const SKILL_REPO = "RGC-LABS/public-assets";
const SKILL_NAME = "rgc-public-assets";
const SKILL_RAW = `https://raw.githubusercontent.com/${SKILL_REPO}/main/skills/${SKILL_NAME}/SKILL.md`;
const SKILL_ZIP = `https://github.com/${SKILL_REPO}/archive/refs/heads/main.zip`;

type Step = { text: string; code?: string };
type Client = { value: string; label: string; steps: Step[]; note?: string };

/** Per-client MCP setup. Transport differs per tool — Gemini needs httpUrl, not url. */
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
      { text: "Save, then enable it in a new chat." },
    ],
    note: "Custom connectors need a Pro, Max, Team or Enterprise plan.",
  },
  {
    value: "codex",
    label: "Codex CLI",
    steps: [
      {
        text: "codex mcp add only handles stdio servers, so add the HTTP server to ~/.codex/config.toml:",
        code: `[mcp_servers.rgc-assets]\nurl = "${url}"`,
      },
      { text: "Verify it registered:", code: "codex mcp list" },
    ],
    note: "A url key (rather than command) is what makes Codex pick the HTTP transport.",
  },
  {
    value: "cursor",
    label: "Cursor",
    steps: [
      {
        text: "Add to ~/.cursor/mcp.json for every project, or .cursor/mcp.json for just this one:",
        code: JSON.stringify({ mcpServers: { "rgc-assets": { url } } }, null, 2),
      },
      { text: "Settings → MCP, and check rgc-assets is enabled." },
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
      { text: "Open Chat in Agent mode, then pick the tools from the toolbar." },
    ],
  },
  {
    value: "gemini",
    label: "Gemini CLI",
    steps: [
      {
        text: "Add to ~/.gemini/settings.json:",
        code: JSON.stringify({ mcpServers: { "rgc-assets": { httpUrl: url } } }, null, 2),
      },
      { text: "Check it loaded:", code: "/mcp" },
    ],
    note: "httpUrl selects streamable HTTP. A plain url key would mean SSE and will not work here.",
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
      { text: "Settings → Connectors → Advanced → turn on Developer mode." },
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

const INSTALL_PROMPT = `Install the RGC public assets agent skill.

Run: npx skills add ${SKILL_REPO} --skill ${SKILL_NAME}

If the skills CLI is unavailable, fetch ${SKILL_RAW} and save it as ${SKILL_NAME}/SKILL.md inside your agent's skills directory (~/.claude/skills for Claude Code, .cursor/rules for Cursor, ~/.codex/skills for Codex), then confirm the skill is listed.`;

const TOOLS: [string, string][] = [
  ["search_assets", "Find assets by filename or path, optionally inside one category."],
  ["get_asset", "One asset by exact path, with dimensions, provenance and pinned urls."],
  ["list_categories", "What categories exist and how many files each holds."],
  ["check_pin", "Whether a url you embedded earlier has gone stale."],
];

const EXAMPLES: [string, string][] = [
  ["Which logo files are in the library? Give me the pinned url for the vector one.", "search_assets"],
  ["Add the RGC wordmark to the header of index.html, using a pinned url.", "search_assets, then embed"],
  ["What product screens exist, and what resolution is each one?", "search_assets, metadata"],
  ["Find a 3D motif that works on a dark hero section and give me the markdown for it.", "search_assets"],
  ["I embedded screens/roas-screen.png a while back — here is the content_id I stored. Is my url still current?", "check_pin"],
];

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

function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex flex-col gap-(--rgc-space-3) p-(--rgc-space-3)">
      {steps.map((s, i) => (
        <li key={i} className="flex flex-col gap-(--rgc-space-2)">
          <span className="text-(length:--rgc-text-ui) text-fg">
            <span className="text-fg-subtle tabular-nums">{i + 1}. </span>
            {s.text}
          </span>
          {s.code ? <Code value={s.code} /> : null}
        </li>
      ))}
    </ol>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Separator />
      <p className="p-(--rgc-space-3) text-(length:--rgc-text-micro) text-fg-subtle">{children}</p>
    </>
  );
}

function ConnectStep({ url }: { url: string }) {
  const [client, setClient] = useState("claude-code");
  const all = clients(url || "…");
  const active = all.find((c) => c.value === client) ?? all[0];

  return (
    <>
      <Panel>
        <PanelHeader title="Endpoint" actions={<Chip tone="ok">no auth</Chip>} />
        <div className="p-(--rgc-space-3)">
          <Code value={url || "…"} />
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Your coding tool"
          actions={
            <Select
              items={all.map((c) => ({ value: c.value, label: c.label }))}
              value={client}
              onValueChange={(v) => setClient(v ?? "claude-code")}
              aria-label="Choose your coding tool"
              size="sm"
            />
          }
        />
        <Steps steps={active.steps} />
        {active.note ? <Note>{active.note}</Note> : null}
      </Panel>

      <Panel>
        <PanelHeader title="What the agent gets" actions={<Chip tone="neutral">{TOOLS.length} tools</Chip>} />
        <DescriptionList.Root>
          {TOOLS.map(([name, what]) => (
            <Fragment key={name}>
              <DescriptionList.Term>
                <span className="font-mono text-(length:--rgc-text-micro) text-accent">{name}</span>
              </DescriptionList.Term>
              <DescriptionList.Detail>
                <span className="text-(length:--rgc-text-micro) text-fg-muted">{what}</span>
              </DescriptionList.Detail>
            </Fragment>
          ))}
        </DescriptionList.Root>
      </Panel>
    </>
  );
}

function SkillStep() {
  const [how, setHow] = useState("cli");

  return (
    <>
      <Panel>
        <PanelHeader title="Why install the skill too" />
        <div className="flex flex-col gap-(--rgc-space-2) p-(--rgc-space-3)">
          <p className="text-(length:--rgc-text-ui) text-fg-muted">
            The MCP server hands the agent the tools. The skill teaches it the rules:
            copy pinned urls verbatim, never rewrite one to point at a branch, and check
            <span className="font-mono"> content_id</span> before changing a url it already
            shipped. Without it an agent will happily &ldquo;tidy&rdquo; a long url into one
            that breaks at the next re-export.
          </p>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="Install it"
          actions={
            <SegmentedControl
              items={[
                { value: "cli", label: "CLI" },
                { value: "prompt", label: "Prompt" },
                { value: "zip", label: "Zip" },
              ]}
              value={how}
              onValueChange={setHow}
              aria-label="Choose an install method"
              size="sm"
            />
          }
        />
        {how === "cli" ? (
          <>
            <Steps
              steps={[
                { text: "Install into whichever agents you use:", code: `npx skills add ${SKILL_REPO}` },
                { text: "Confirm it landed:", code: "npx skills list" },
              ]}
            />
            <Note>
              Works with Claude Code, Claude Desktop, Cursor, VS Code, Codex, Gemini,
              Windsurf and Zed. Add <span className="font-mono">-g</span> to install
              globally rather than into the current project.
            </Note>
          </>
        ) : null}
        {how === "prompt" ? (
          <>
            <div className="p-(--rgc-space-3)">
              <p className="pb-(--rgc-space-2) text-(length:--rgc-text-micro) text-fg-subtle">
                Paste this to any connected agent and it will install the skill itself.
              </p>
              <Code value={INSTALL_PROMPT} />
            </div>
          </>
        ) : null}
        {how === "zip" ? (
          <>
            <Steps
              steps={[
                { text: "Download the skill:" },
                {
                  text: "Unzip it and copy the skill folder into your agent's skills directory:",
                  code: `unzip public-assets-main.zip\ncp -R public-assets-main/skills/${SKILL_NAME} ~/.claude/skills/`,
                },
                { text: "Restart the agent, and confirm the skill is listed." },
              ]}
            />
            <div className="px-(--rgc-space-3) pb-(--rgc-space-3)">
              <Button
                variant="secondary"
                size="sm"
                render={<a href={SKILL_ZIP} download />}
              >
                Download zip
              </Button>
            </div>
            <Note>
              Paths differ per agent: <span className="font-mono">~/.claude/skills</span> for
              Claude Code, <span className="font-mono">~/.codex/skills</span> for Codex,
              <span className="font-mono"> .cursor</span> for Cursor.
            </Note>
          </>
        ) : null}
      </Panel>

      <Panel>
        <PanelHeader title="Then try asking" />
        <div className="flex flex-col gap-(--rgc-space-2) p-(--rgc-space-3)">
          {EXAMPLES.map(([ask, shows]) => (
            <div
              key={ask}
              className="flex items-start gap-(--rgc-space-2) rounded-(--radius-control) bg-surface-2 p-(--rgc-space-3)"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-(--rgc-space-1)">
                <span className="text-(length:--rgc-text-ui) text-fg">&ldquo;{ask}&rdquo;</span>
                <span className="font-mono text-(length:--rgc-text-micro) text-fg-subtle">{shows}</span>
              </div>
              <CopyButton value={ask}>Copy</CopyButton>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

const STEPS = [
  { id: "mcp", label: "Connect MCP" },
  { id: "skill", label: "Install skill" },
];

export function ConnectDialog() {
  const [url, setUrl] = useState("");
  const [step, setStep] = useState("mcp");

  // Follows wherever this is deployed, so instructions stay correct on any url.
  useEffect(() => setUrl(`${window.location.origin}/mcp`), []);

  return (
    <Dialog.Root>
      <Dialog.Trigger
        render={<Button icon={Plug} size="sm" variant="secondary">Connect to agent</Button>}
      />
      <Dialog.Content width="lg">
        <Dialog.Title>Connect an agent</Dialog.Title>
        <Dialog.Description>
          Two steps: connect the MCP server so the agent can search the library, then
          install the skill so it uses the urls correctly.
        </Dialog.Description>

        <Stepper steps={STEPS} current={step} onStepChange={setStep} label="Setup" />

        <div className="flex max-h-[55vh] flex-col gap-(--rgc-space-4) overflow-y-auto">
          {step === "mcp" ? <ConnectStep url={url} /> : <SkillStep />}
        </div>

        <Dialog.Footer>
          {step === "mcp" ? (
            <Button variant="primary" onClick={() => setStep("skill")}>
              Next: install the skill
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setStep("mcp")}>
                Back
              </Button>
              <Dialog.Close render={<Button variant="primary">Done</Button>} />
            </>
          )}
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
