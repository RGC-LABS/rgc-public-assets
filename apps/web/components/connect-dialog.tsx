"use client";

import { Fragment, useEffect, useState } from "react";
import {
  Button,
  Chip,
  CopyButton,
  DescriptionList,
  Dialog,
  Disclosure,
  Panel,
  PanelHeader,
  Separator,
  Stepper,
} from "@rgc-labs/ui";
import { Check, Download, Plug, Terminal } from "lucide-react";

const SKILL_REPO = "RGC-LABS/public-assets";
const SKILL_NAME = "rgc-public-assets";
const SKILL_RAW = `https://raw.githubusercontent.com/${SKILL_REPO}/main/skills/${SKILL_NAME}/SKILL.md`;
const SKILL_ZIP = `https://github.com/${SKILL_REPO}/archive/refs/heads/main.zip`;

type Action = { do: string; code?: string; href?: string; hrefLabel?: string };

/**
 * btoa() throws on anything outside Latin1, which took the whole page down when
 * a placeholder ellipsis reached it during hydration. Encode to UTF-8 bytes
 * first, and never throw: a deeplink is a convenience, not a reason to crash.
 */
function base64(value: string): string {
  try {
    return btoa(String.fromCharCode(...new TextEncoder().encode(value)));
  } catch {
    return "";
  }
}
type Agent = {
  value: string;
  label: string;
  hint: string;
  install: Action[];
  manual: Action[];
  /** True when `install` also delivers the skill, making step 3 a no-op. */
  bundlesSkill?: boolean;
};

/**
 * Transports genuinely differ per agent, so these are not interchangeable:
 * `codex mcp add` handles stdio only, and Gemini reads `httpUrl` — a plain
 * `url` there means SSE and will not connect.
 */
const agents = (url: string): Agent[] => [
  {
    value: "claude-code",
    label: "Claude Code",
    hint: "plugin · one step",
    bundlesSkill: true,
    install: [
      {
        do: "Run these two inside Claude Code. The plugin carries the server and the skill together, so step 3 is already done.",
        code: `/plugin marketplace add ${SKILL_REPO}\n/plugin install ${SKILL_NAME}@rgc-labs`,
      },
    ],
    manual: [
      { do: "Prefer the server on its own, without the skill?", code: `claude mcp add --transport http rgc-assets ${url}` },
      {
        do: "Or add it straight to .mcp.json in your project root:",
        code: JSON.stringify({ mcpServers: { "rgc-assets": { type: "http", url } } }, null, 2),
      },
      { do: "Either way, /mcp inside Claude Code shows whether it connected." },
    ],
  },
  {
    value: "claude-desktop",
    label: "Claude Desktop",
    hint: "app settings",
    install: [
      { do: "Settings → Connectors → Add custom connector." },
      { do: "Paste this as the server URL, then save.", code: url },
    ],
    manual: [
      { do: "The connector appears in the tools menu of a new chat — enable it there." },
      { do: "Custom connectors need a Pro, Max, Team or Enterprise plan." },
    ],
  },
  {
    value: "codex",
    label: "Codex CLI",
    hint: "config file",
    install: [
      { do: "Add this to ~/.codex/config.toml.", code: `[mcp_servers.rgc-assets]\nurl = "${url}"` },
      { do: "Confirm it registered.", code: "codex mcp list" },
    ],
    manual: [
      { do: "There is no CLI shortcut here: codex mcp add only takes stdio servers, so an HTTP server has to go in the file." },
      { do: "A url key rather than a command is what makes Codex choose the HTTP transport." },
    ],
  },
  {
    value: "cursor",
    label: "Cursor",
    hint: "one click",
    install: [
      {
        do: "Click to install, then approve the prompt in Cursor.",
        href: url
          ? `cursor://anysphere.cursor-deeplink/mcp/install?name=rgc-assets&config=${base64(
              JSON.stringify({ url }),
            )}`
          : undefined,
        hrefLabel: "Add to Cursor",
      },
    ],
    manual: [
      {
        do: "If the link does nothing, add it to ~/.cursor/mcp.json for every project, or .cursor/mcp.json for just this one:",
        code: JSON.stringify({ mcpServers: { "rgc-assets": { url } } }, null, 2),
      },
      { do: "Then check Settings → MCP shows rgc-assets enabled." },
    ],
  },
  {
    value: "vscode",
    label: "VS Code",
    hint: "terminal",
    install: [
      {
        do: "Click to install, then confirm in VS Code.",
        href: url
          ? `vscode:mcp/install?${encodeURIComponent(
              JSON.stringify({ name: "rgc-assets", type: "http", url }),
            )}`
          : undefined,
        hrefLabel: "Add to VS Code",
      },
      {
        do: "Or run it from a terminal, then reload the window.",
        code: `code --add-mcp '{"name":"rgc-assets","type":"http","url":"${url}"}'`,
      },
    ],
    manual: [
      {
        do: "Or create .vscode/mcp.json in your workspace:",
        code: JSON.stringify({ servers: { "rgc-assets": { type: "http", url } } }, null, 2),
      },
      { do: "Open Chat in Agent mode, then pick the tools from the toolbar." },
    ],
  },
  {
    value: "gemini",
    label: "Gemini CLI",
    hint: "terminal",
    install: [
      { do: "Run this, then restart the CLI.", code: `gemini mcp add --transport http rgc-assets ${url}` },
    ],
    manual: [
      {
        do: "Or add it to ~/.gemini/settings.json:",
        code: JSON.stringify({ mcpServers: { "rgc-assets": { httpUrl: url } } }, null, 2),
      },
      { do: "It must be httpUrl. A plain url key means SSE here and will not connect." },
    ],
  },
  {
    value: "windsurf",
    label: "Windsurf",
    hint: "config file",
    install: [
      {
        do: "Add this to ~/.codeium/windsurf/mcp_config.json.",
        code: JSON.stringify({ mcpServers: { "rgc-assets": { serverUrl: url } } }, null, 2),
      },
      { do: "Then open Cascade → MCP panel → Refresh." },
    ],
    manual: [{ do: "Windsurf uses serverUrl rather than url for remote servers." }],
  },
  {
    value: "chatgpt",
    label: "ChatGPT",
    hint: "app settings",
    install: [
      { do: "Settings → Connectors → Advanced → turn on Developer mode." },
      { do: "Create a connector with this MCP server URL.", code: url },
    ],
    manual: [{ do: "Developer mode availability depends on your ChatGPT plan." }],
  },
  {
    value: "other",
    label: "Something else",
    hint: "any MCP client",
    install: [{ do: "Point your client at this endpoint over streamable HTTP.", code: url }],
    manual: [{ do: "No authentication and no headers required — the asset library is public." }],
  },
];

const INSTALL_PROMPT = `Install the RGC public assets agent skill.

Run: npx skills add ${SKILL_REPO} --skill ${SKILL_NAME}

If the skills CLI is unavailable, fetch ${SKILL_RAW} and save it as ${SKILL_NAME}/SKILL.md inside your agent's skills directory, then confirm the skill is listed.`;

const TOOLS: [string, string][] = [
  ["search_assets", "Find assets by filename or path, optionally inside one category."],
  ["get_asset", "One asset by exact path, with dimensions, provenance and pinned urls."],
  ["list_categories", "What categories exist and how many files each holds."],
  ["check_pin", "Whether a url you embedded earlier has gone stale."],
];

function Code({ value }: { value: string }) {
  if (!value) {
    return (
      <div className="rounded-(--radius-control) bg-surface-2 p-(--rgc-space-3) font-mono text-(length:--rgc-text-micro) text-fg-subtle">
        resolving endpoint…
      </div>
    );
  }
  return (
    <div className="flex items-start gap-(--rgc-space-2)">
      <pre className="min-w-0 flex-1 overflow-x-auto rounded-(--radius-control) bg-surface-2 p-(--rgc-space-3) font-mono text-(length:--rgc-text-micro) text-fg">
        {value}
      </pre>
      <CopyButton value={value}>Copy</CopyButton>
    </div>
  );
}

function Actions({ actions, numbered = true }: { actions: Action[]; numbered?: boolean }) {
  return (
    <ol className="flex flex-col gap-(--rgc-space-3)">
      {actions.map((a, i) => (
        <li key={i} className="flex flex-col gap-(--rgc-space-2)">
          <span className="text-(length:--rgc-text-ui) text-fg">
            {numbered ? <span className="text-fg-subtle tabular-nums">{i + 1}. </span> : null}
            {a.do}
          </span>
          {a.code ? <Code value={a.code} /> : null}
          {a.href && a.href.length > 0 ? (
            <span>
              <Button variant="primary" size="sm" render={<a href={a.href} />}>
                {a.hrefLabel ?? "Open"}
              </Button>
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function ChooseStep({
  all,
  agent,
  onPick,
}: {
  all: Agent[];
  agent: string;
  onPick: (v: string) => void;
}) {
  return (
    <Panel>
      <PanelHeader title="Which agent are you using?" />
      <div className="grid grid-cols-2 gap-(--rgc-space-2) p-(--rgc-space-3) sm:grid-cols-3">
        {all.map((a) => {
          const selected = a.value === agent;
          return (
            <button
              key={a.value}
              type="button"
              onClick={() => onPick(a.value)}
              aria-pressed={selected}
              className="flex flex-col items-start gap-(--rgc-space-1) rounded-(--radius-control) border border-border bg-surface-1 p-(--rgc-space-3) text-left transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent aria-pressed:border-accent aria-pressed:bg-surface-2"
            >
              <span className="flex w-full items-center gap-(--rgc-space-2)">
                <span className="min-w-0 flex-1 truncate text-(length:--rgc-text-ui) text-fg">
                  {a.label}
                </span>
                {selected ? <Check className="size-icon-sm shrink-0 text-accent" aria-hidden /> : null}
              </span>
              <span className="text-(length:--rgc-text-micro) text-fg-subtle">{a.hint}</span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function InstallStep({ agent, url }: { agent: Agent; url: string }) {
  return (
    <>
      <Panel>
        <PanelHeader
          title={`Connect the server to ${agent.label}`}
          actions={<Chip tone="ok">no auth</Chip>}
        />
        <div className="p-(--rgc-space-3)">
          <Actions actions={agent.install} />
        </div>
        <Separator />
        <div className="p-(--rgc-space-3)">
          <Disclosure label="Manual install">
            <div className="pt-(--rgc-space-2)">
              <Actions actions={agent.manual} numbered={false} />
            </div>
          </Disclosure>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          title="What this gives the agent"
          actions={<Chip tone="neutral">{TOOLS.length} tools</Chip>}
        />
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
        <Separator />
        <div className="p-(--rgc-space-3)">
          <Disclosure label="The endpoint">
            <div className="pt-(--rgc-space-2)">
              <Code value={url} />
            </div>
          </Disclosure>
        </div>
      </Panel>
    </>
  );
}

function SkillStep({ agent }: { agent: Agent }) {
  if (agent.bundlesSkill) {
    return (
      <>
        <Panel>
          <PanelHeader
            title="Already done"
            actions={<Chip tone="ok">installed with the plugin</Chip>}
          />
          <div className="flex flex-col gap-(--rgc-space-3) p-(--rgc-space-3)">
            <p className="text-(length:--rgc-text-ui) text-fg-muted">
              The {agent.label} plugin carries the skill as well as the server, so there is
              nothing else to install. Confirm both arrived:
            </p>
            <Code value={`claude plugin details ${SKILL_NAME}`} />
            <p className="text-(length:--rgc-text-micro) text-fg-subtle">
              It should list one skill and one MCP server.
            </p>
          </div>
          <Separator />
          <div className="p-(--rgc-space-3)">
            <Disclosure label="Install the skill separately anyway">
              <div className="flex flex-col gap-(--rgc-space-2) pt-(--rgc-space-2)">
                <span className="text-(length:--rgc-text-micro) text-fg-subtle">
                  For another agent on the same machine, or if you skipped the plugin:
                </span>
                <Code value={`npx skills add ${SKILL_REPO}`} />
              </div>
            </Disclosure>
          </div>
        </Panel>
        <WhySkill />
      </>
    );
  }

  return (
    <>
      <Panel>
        <PanelHeader title="Install the skill" actions={<Chip tone="accent">one command</Chip>} />
        <div className="p-(--rgc-space-3)">
          <Actions
            actions={[
              { do: "Run this and pick your agent when prompted.", code: `npx skills add ${SKILL_REPO}` },
            ]}
            numbered={false}
          />
        </div>
        <Separator />
        <div className="flex flex-col gap-(--rgc-space-3) p-(--rgc-space-3)">
          <Disclosure label="More details">
            <div className="flex flex-col gap-(--rgc-space-4) pt-(--rgc-space-2)">
              <div className="flex flex-col gap-(--rgc-space-2)">
                <span className="text-(length:--rgc-text-label) text-fg">Ask your agent to do it</span>
                <Code value={INSTALL_PROMPT} />
              </div>

              <div className="flex flex-col gap-(--rgc-space-2)">
                <span className="text-(length:--rgc-text-label) text-fg">Install by hand</span>
                <span className="text-(length:--rgc-text-micro) text-fg-subtle">
                  Download the zip, then copy the skill folder into your agent&rsquo;s skills
                  directory — <span className="font-mono">~/.claude/skills</span> for Claude Code,
                  <span className="font-mono"> ~/.codex/skills</span> for Codex.
                </span>
                <Code value={`unzip public-assets-main.zip\ncp -R public-assets-main/skills/${SKILL_NAME} ~/.claude/skills/`} />
                <span>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Download}
                    render={<a href={SKILL_ZIP} download />}
                  >
                    Download zip
                  </Button>
                </span>
              </div>

              <div className="flex flex-col gap-(--rgc-space-2)">
                <span className="text-(length:--rgc-text-label) text-fg">Global rather than per-project</span>
                <Code value={`npx skills add ${SKILL_REPO} -g`} />
              </div>
            </div>
          </Disclosure>
        </div>
      </Panel>

      <WhySkill />
    </>
  );
}

function WhySkill() {
  return (
    <Panel>
      <PanelHeader title="Why the skill as well as the server" />
      <div className="p-(--rgc-space-3)">
        <p className="text-(length:--rgc-text-ui) text-fg-muted">
          The server gives the agent the tools. The skill teaches it the rules: copy pinned
          urls verbatim, never rewrite one to point at a branch, and check{" "}
          <span className="font-mono">content_id</span> before changing a url it already
          shipped. Without it an agent will happily &ldquo;tidy&rdquo; a long url into one
          that breaks at the next re-export.
        </p>
      </div>
    </Panel>
  );
}

const STEPS = [
  { id: "agent", label: "Choose agent" },
  { id: "install", label: "Install" },
  { id: "skill", label: "Add skill" },
];

export function ConnectDialog() {
  const [url, setUrl] = useState("");
  const [step, setStep] = useState("agent");
  const [agent, setAgent] = useState("claude-code");

  // Follows wherever this is deployed, so instructions stay correct on any url.
  useEffect(() => setUrl(`${window.location.origin}/mcp`), []);

  const all = agents(url);
  const active = all.find((a) => a.value === agent) ?? all[0];
  const index = STEPS.findIndex((s) => s.id === step);

  return (
    <Dialog.Root>
      <Dialog.Trigger
        render={<Button icon={Plug} size="sm" variant="secondary">Connect to agent</Button>}
      />
      <Dialog.Content width="lg">
        <Dialog.Title>Connect an agent</Dialog.Title>
        <Dialog.Description>
          Three steps: pick your agent, connect the server, add the skill.
        </Dialog.Description>

        <Stepper steps={STEPS} current={step} onStepChange={setStep} label="Setup" />

        <div className="flex max-h-[55vh] flex-col gap-(--rgc-space-4) overflow-y-auto">
          {step === "agent" ? (
            <ChooseStep
              all={all}
              agent={agent}
              onPick={(v) => {
                setAgent(v);
                setStep("install");
              }}
            />
          ) : null}
          {step === "install" ? <InstallStep agent={active} url={url} /> : null}
          {step === "skill" ? <SkillStep agent={active} /> : null}
        </div>

        <Dialog.Footer>
          {index > 0 ? (
            <Button variant="ghost" onClick={() => setStep(STEPS[index - 1].id)}>
              Back
            </Button>
          ) : null}
          {step === "agent" ? (
            <Button variant="primary" icon={Terminal} onClick={() => setStep("install")}>
              Continue with {active.label}
            </Button>
          ) : null}
          {step === "install" ? (
            <Button variant="primary" onClick={() => setStep("skill")}>
              {active.bundlesSkill ? "Done — what's next" : "Done — add the skill"}
            </Button>
          ) : null}
          {step === "skill" ? (
            <Dialog.Close render={<Button variant="primary">Finish</Button>} />
          ) : null}
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  );
}
