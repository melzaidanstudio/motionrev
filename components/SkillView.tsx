"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Tab = "render" | "raw";

export function SkillView({ md }: { md: string }) {
  const [tab, setTab] = useState<Tab>("render");
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  const tabBtn = (t: Tab, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === t}
      onClick={() => setTab(t)}
      className={`min-h-11 px-3 text-sm border-b-2 -mb-px ${
        tab === t ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="panel">
      <div className="flex items-center justify-between border-b border-line px-3">
        <div role="tablist" aria-label="Tampilan SKILL.md" className="flex gap-1">
          {tabBtn("render", "Tampilan")}
          {tabBtn("raw", "Mentah")}
        </div>
        <button type="button" onClick={copy} className="btn !min-h-9 text-xs">
          {copied ? "Tersalin" : "Salin teks"}
        </button>
      </div>
      {tab === "render" ? (
        <div role="tabpanel" className="md max-w-3xl p-4 md:p-6">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{stripFrontmatter(md)}</ReactMarkdown>
        </div>
      ) : (
        <pre role="tabpanel" className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-fg">
          {md}
        </pre>
      )}
    </div>
  );
}

/** The rendered tab shows the body; the frontmatter is only useful in the raw file. */
function stripFrontmatter(md: string): string {
  const m = md.match(/^---\n[\s\S]*?\n---\n/);
  return m ? md.slice(m[0].length) : md;
}
