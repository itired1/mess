import { Fragment, ReactNode } from "react";

export function formatClock(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatDay(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Сегодня";
  const y = new Date(now.getTime() - 86400_000);
  if (d.toDateString() === y.toDateString()) return "Вчера";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

export function formatListTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return formatClock(ts);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c
  );
}

const TOKEN = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`|\r?\n)/g;

export function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let key = 0;
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(TOKEN.source, "g");
  while ((m = re.exec(text)) !== null) {
    const head = text.slice(last, m.index);
    if (head) out.push(<Fragment key={key++}>{escapeHtml(head)}</Fragment>);
    const t = m[1];
    if (t === "\n" || t === "\r\n") {
      out.push(<br key={key++} />);
    } else if (t.startsWith("**") && t.endsWith("**")) {
      out.push(<strong key={key++}>{escapeHtml(t.slice(2, -2))}</strong>);
    } else if (t.startsWith("*") && t.endsWith("*")) {
      out.push(<em key={key++}>{escapeHtml(t.slice(1, -1))}</em>);
    } else if (t.startsWith("`") && t.endsWith("`")) {
      out.push(<code key={key++}>{escapeHtml(t.slice(1, -1))}</code>);
    }
    last = m.index + t.length;
  }
  const rest = text.slice(last);
  if (rest) out.push(<Fragment key={key++}>{escapeHtml(rest)}</Fragment>);
  return out;
}

export function linkify(text: string): ReactNode[] {
  const regex = /(https?:\/\/[^\s]+)/g;
  const parts = escapeHtml(text).split(regex);
  const out: ReactNode[] = [];
  parts.forEach((part, i) => {
    if (regex.test(part)) {
      out.push(
        <a key={i} className="msg-link" href={part} target="_blank" rel="noopener noreferrer">
          {part}
        </a>
      );
    } else {
      out.push(<Fragment key={i}>{part}</Fragment>);
    }
  });
  return out;
}