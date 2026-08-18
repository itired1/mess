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

const TOKEN = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|~~[^~\n]+~~|`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|\r?\n)/g;

export function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let key = 0;
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(TOKEN.source, "g");
  while ((m = re.exec(text)) !== null) {
    const head = text.slice(last, m.index);
    if (head) out.push(escapeHtml(head));
    const t = m[1];
    if (t === "\n" || t === "\r\n") {
      out.push(<br key={key++} />);
    } else if (t.startsWith("**") && t.endsWith("**")) {
      out.push(<strong key={key++}>{escapeHtml(t.slice(2, -2))}</strong>);
    } else if (t.startsWith("~~") && t.endsWith("~~")) {
      out.push(<s key={key++}>{escapeHtml(t.slice(2, -2))}</s>);
    } else if (t.startsWith("*") && t.endsWith("*")) {
      out.push(<em key={key++}>{escapeHtml(t.slice(1, -1))}</em>);
    } else if (t.startsWith("`") && t.endsWith("`")) {
      out.push(<code key={key++}>{escapeHtml(t.slice(1, -1))}</code>);
    } else {
      const lm = t.match(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/);
      if (lm) {
        out.push(
          <a key={key++} className="msg-link" href={lm[2]} target="_blank" rel="noopener noreferrer">
            {escapeHtml(lm[1])}
          </a>
        );
      } else {
        out.push(escapeHtml(t));
      }
    }
    last = m.index + t.length;
  }
  const rest = text.slice(last);
  if (rest) out.push(escapeHtml(rest));
  return out;
}

export function renderBlocks(text: string): ReactNode[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  const buf: string[] = [];
  let key = 0;
  const flushPara = () => {
    if (buf.length) {
      blocks.push(<p key={key++}>{renderInline(buf.join("\n"))}</p>);
      buf.length = 0;
    }
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      flushPara();
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      i++;
      blocks.push(
        <pre key={key++}>
          <code>{code.join("\n")}</code>
        </pre>
      );
      continue;
    }
    const li = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);
    if (li) {
      flushPara();
      const ordered = /^\s*\d+\./.test(line);
      const items: ReactNode[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);
        if (!m) break;
        items.push(<li key={i}>{renderInline(m[1])}</li>);
        i++;
      }
      blocks.push(ordered ? <ol key={key++}>{items}</ol> : <ul key={key++}>{items}</ul>);
      continue;
    }
    buf.push(line);
    i++;
  }
  flushPara();
  return blocks;
}

export function pluralRu(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} ${one}`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

export function lastSeenLabel(ts: number): string {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return "был(а) только что";
  const min = Math.floor(s / 60);
  if (min < 60) return `был(а) ${pluralRu(min, "минуту назад", "минуты назад", "минут назад")}`;
  const h = Math.floor(min / 60);
  if (h < 24) return `был(а) ${pluralRu(h, "час назад", "часа назад", "часов назад")}`;
  const d = Math.floor(h / 24);
  if (d < 7) return d === 1 ? "был(а) вчера" : `был(а) ${pluralRu(d, "день назад", "дня назад", "дней назад")}`;
  const now = new Date();
  const dt = new Date(ts);
  const date = dt.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: dt.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
  return `был(а) ${date}`;
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