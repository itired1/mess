import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Chat, Message, ReactionMap, ReplyRef, User } from "./types.js";

const DB_PATH =
  process.env.DB_PATH ??
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "data",
    "db.json"
  );

let seq = 1;
const nextId = () => `id_${seq++}`;

interface FullUser extends User {
  passwordHash: string;
}

const GRADIENTS = [
  "linear-gradient(135deg,#7c6cff,#4f8cff)",
  "linear-gradient(135deg,#ff9a9e,#fad0c4)",
  "linear-gradient(135deg,#667eea,#764ba2)",
  "linear-gradient(135deg,#f093fb,#f5576c)",
  "linear-gradient(135deg,#43e97b,#38f9d7)",
  "linear-gradient(135deg,#f6d365,#fda085)",
  "linear-gradient(135deg,#30cfd0,#330867)",
  "linear-gradient(135deg,#a18cd1,#fbc2eb)",
];

const USERS: FullUser[] = [];
export const CHATS: Chat[] = [];
export const READ_UP_TO: Record<string, number> = {};
export const ONLINE = new Set<string>();

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function saveNow() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  try {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(
      DB_PATH,
      JSON.stringify({ seq, users: USERS, chats: CHATS, readUpTo: READ_UP_TO })
    );
  } catch (e) {
    console.warn("Не удалось сохранить данные:", (e as Error).message);
  }
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 250);
}

function loadDb() {
  try {
    if (!fs.existsSync(DB_PATH)) return;
    const raw = fs.readFileSync(DB_PATH, "utf8");
    const d = JSON.parse(raw) as {
      seq?: number;
      users?: FullUser[];
      chats?: Chat[];
      readUpTo?: Record<string, number>;
    };
    if (typeof d.seq === "number") seq = d.seq;
    if (Array.isArray(d.users)) USERS.push(...d.users);
    if (Array.isArray(d.chats)) CHATS.push(...d.chats);
    if (d.readUpTo) Object.assign(READ_UP_TO, d.readUpTo);
  } catch (e) {
    console.warn("Не удалось прочитать сохранённые данные:", (e as Error).message);
  }
}

loadDb();

function publicUser(u: FullUser): User {
  return { id: u.id, name: u.name, gradient: u.gradient, online: ONLINE.has(u.id) };
}

function userById(id: string): FullUser | undefined {
  return USERS.find((u) => u.id === id);
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const calc = crypto.scryptSync(password, salt, 32).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(calc, "hex"));
}

export function registerUser(name: string, password: string): User | null {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 24) return null;
  if (password.length < 4) return null;
  if (USERS.some((u) => u.name.toLowerCase() === trimmed.toLowerCase())) return null;

  const u: FullUser = {
    id: nextId(),
    name: trimmed,
    gradient: GRADIENTS[USERS.length % GRADIENTS.length],
    online: false,
    passwordHash: hashPassword(password),
  };
  USERS.push(u);
  scheduleSave();
  return publicUser(u);
}

export function loginUser(name: string, password: string): User | null {
  const u = USERS.find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
  if (!u || !verifyPassword(password, u.passwordHash)) return null;
  return publicUser(u);
}

export function getUser(id: string): User | null {
  const u = userById(id);
  return u ? publicUser(u) : null;
}

export function listUsers(excludeId?: string): User[] {
  return USERS.filter((u) => u.id !== excludeId).map(publicUser);
}

export function userName(id: string): string {
  return userById(id)?.name ?? "Гость";
}

export function getChat(id: string): Chat | undefined {
  return CHATS.find((c) => c.id === id);
}

export function getMessage(chatId: string, messageId: string): Message | undefined {
  return getChat(chatId)?.messages.find((m) => m.id === messageId);
}

export function addMessage(
  chatId: string,
  authorId: string,
  text: string,
  replyTo?: ReplyRef | null
): Message | null {
  const c = getChat(chatId);
  if (!c) return null;
  const m: Message = {
    id: nextId(),
    chatId,
    authorId,
    authorName: userName(authorId),
    text,
    ts: Date.now(),
    edited: false,
    deleted: false,
  };
  if (replyTo) {
    m.replyTo = {
      id: replyTo.id,
      authorId: replyTo.authorId,
      authorName: replyTo.authorName ?? userName(replyTo.authorId),
      text: replyTo.text,
    };
  }
  c.messages.push(m);
  scheduleSave();
  return m;
}

export function deleteMessage(chatId: string, messageId: string, authorId: string): Message | null {
  const m = getMessage(chatId, messageId);
  if (!m || m.authorId !== authorId) return null;
  m.deleted = true;
  m.text = "";
  scheduleSave();
  return m;
}

export function toggleReaction(
  chatId: string,
  messageId: string,
  emoji: string,
  userId: string
): Message | null {
  const m = getMessage(chatId, messageId);
  if (!m) return null;
  m.reactions = m.reactions ?? {};
  const list = m.reactions[emoji];
  if (list && list.includes(userId)) {
    m.reactions[emoji] = list.filter((id) => id !== userId);
    if (m.reactions[emoji].length === 0) delete m.reactions[emoji];
  } else {
    m.reactions[emoji] = [...(list ?? []), userId];
  }
  if (Object.keys(m.reactions).length === 0) m.reactions = undefined;
  scheduleSave();
  return m;
}

export function addChat(ownerId: string, name: string, memberIds: string[]): Chat {
  const ids = Array.from(new Set([ownerId, ...memberIds])).filter((id) => userById(id));
  const first = ids.find((id) => id !== ownerId);
  const firstUser = first ? userById(first) : undefined;
  const c: Chat = {
    id: `chat_${nextId()}`,
    name: name.trim() || firstUser?.name || "Новый чат",
    gradient: firstUser?.gradient || "linear-gradient(135deg,#7c6cff,#4f8cff)",
    members: ids,
    messages: [],
  };
  CHATS.push(c);
  scheduleSave();
  return c;
}

export type { ReactionMap };