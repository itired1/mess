import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Attachment, Chat, Message, ReactionMap, ReplyRef, User } from "./types.js";

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
export const LAST_SEEN = new Map<string, number>();

const TOKENS = new Map<string, string>();

interface FriendRequest {
  from: string;
  to: string;
  ts: number;
}
interface FriendPair {
  a: string;
  b: string;
}

const FRIEND_REQUESTS: FriendRequest[] = [];
const FRIEND_PAIRS: FriendPair[] = [];

const pairKey = (a: string, b: string) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);

function areFriends(a: string, b: string): boolean {
  return FRIEND_PAIRS.some((p) => pairKey(p.a, p.b) === pairKey(a, b));
}

function pendingRequest(from: string, to: string): boolean {
  return FRIEND_REQUESTS.some((r) => r.from === from && r.to === to);
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

const BACKUP_DIR = path.join(path.dirname(DB_PATH), "backups");
const MAX_BACKUPS = 8;

export function saveNow() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  try {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const payload = JSON.stringify({
      seq,
      users: USERS,
      chats: CHATS,
      readUpTo: READ_UP_TO,
      tokens: Array.from(TOKENS.entries()).map(([t, u]) => ({ t, u })),
      friendRequests: FRIEND_REQUESTS,
      friendPairs: FRIEND_PAIRS,
    });
    const tmp = `${DB_PATH}.tmp`;
    fs.writeFileSync(tmp, payload);
    fs.renameSync(tmp, DB_PATH); // атомарная замена

    try {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      fs.copyFileSync(DB_PATH, path.join(BACKUP_DIR, `db-${stamp}.json`));
      const files = fs
        .readdirSync(BACKUP_DIR)
        .filter((f) => f.startsWith("db-") && f.endsWith(".json"))
        .sort();
      while (files.length > MAX_BACKUPS) {
        const victim = files.shift();
        if (victim) {
          try {
            fs.unlinkSync(path.join(BACKUP_DIR, victim));
          } catch {
            /* уже удалён */
          }
        }
      }
    } catch (e) {
      console.warn("Бэкап не создан:", (e as Error).message);
    }
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
      tokens?: { t: string; u: string }[];
      friendRequests?: FriendRequest[];
      friendPairs?: FriendPair[];
    };
    if (typeof d.seq === "number") seq = d.seq;
    if (Array.isArray(d.users)) USERS.push(...d.users);
    if (Array.isArray(d.chats)) CHATS.push(...d.chats);
    if (d.readUpTo) Object.assign(READ_UP_TO, d.readUpTo);
    if (Array.isArray(d.tokens)) for (const { t, u } of d.tokens) TOKENS.set(t, u);
    if (Array.isArray(d.friendRequests)) FRIEND_REQUESTS.push(...d.friendRequests);
    if (Array.isArray(d.friendPairs)) FRIEND_PAIRS.push(...d.friendPairs);
  } catch (e) {
    console.warn("Не удалось прочитать сохранённые данные:", (e as Error).message);
  }
}

loadDb();

function publicUser(u: FullUser): User {
  return {
    id: u.id,
    name: u.name,
    gradient: u.gradient,
    online: ONLINE.has(u.id),
    lastSeen: LAST_SEEN.get(u.id) ?? undefined,
    avatar: u.avatar,
    banner: u.banner,
  };
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

export interface PasswordRule {
  label: string;
  ok: boolean;
}

export function checkPassword(password: string): { ok: boolean; score: number; rules: PasswordRule[] } {
  const rules: PasswordRule[] = [
    { label: "минимум 6 символов", ok: password.length >= 6 },
    { label: "буквы и цифры", ok: /[a-zа-яё]/i.test(password) && /\d/.test(password) },
    { label: "есть заглавная буква", ok: /[A-ZА-ЯЁ]/.test(password) },
    { label: "спецсимвол или 12+", ok: /[^a-z0-9а-яё]/i.test(password) || password.length >= 12 },
  ];
  const score = rules.filter((r) => r.ok).length;
  return { ok: rules[0].ok && rules[1].ok, score, rules };
}

export function isNameTaken(name: string): boolean {
  const trimmed = name.trim();
  return USERS.some((u) => u.name.toLowerCase() === trimmed.toLowerCase());
}

export function registerUser(name: string, password: string): User | null {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 24) return null;
  if (!checkPassword(password).ok) return null;
  if (USERS.some((u) => u.name.toLowerCase() === trimmed.toLowerCase())) return null;

  const u: FullUser = {
    id: nextId(),
    name: trimmed,
    gradient: GRADIENTS[USERS.length % GRADIENTS.length],
    online: false,
    passwordHash: hashPassword(password),
  };
  USERS.push(u);
  LAST_SEEN.set(u.id, Date.now());
  scheduleSave();
  return publicUser(u);
}

export function loginUser(name: string, password: string): User | null {
  const u = USERS.find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
  if (!u || !verifyPassword(password, u.passwordHash)) return null;
  return publicUser(u);
}

export function createToken(userId: string): string {
  const token = crypto.randomBytes(24).toString("hex");
  TOKENS.set(token, userId);
  scheduleSave();
  return token;
}

export function tokenUser(token: string): string | undefined {
  return TOKENS.get(token);
}

export function revokeToken(token: string): void {
  if (TOKENS.delete(token)) scheduleSave();
}

export function getUser(id: string): User | null {
  const u = userById(id);
  return u ? publicUser(u) : null;
}

export function updateProfile(
  userId: string,
  fields: { avatar?: string | null; banner?: string | null }
): User | null {
  const u = userById(userId);
  if (!u) return null;
  if ("avatar" in fields && fields.avatar !== undefined) u.avatar = fields.avatar ?? undefined;
  if ("banner" in fields && fields.banner !== undefined) u.banner = fields.banner ?? undefined;
  scheduleSave();
  return publicUser(u);
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

export const MAX_TEXT_LEN = 4000;

export function addMessage(
  chatId: string,
  authorId: string,
  text: string,
  replyTo?: ReplyRef | null,
  attach?: Attachment | null
): Message | null {
  const c = getChat(chatId);
  if (!c) return null;
  if (!text.trim() && !attach) return null;
  const m: Message = {
    id: nextId(),
    chatId,
    authorId,
    authorName: userName(authorId),
    text: text.trim().slice(0, MAX_TEXT_LEN),
    ts: Date.now(),
    edited: false,
    deleted: false,
    attach: attach ?? undefined,
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

export function editMessage(chatId: string, messageId: string, authorId: string, text: string): Message | null {
  const m = getMessage(chatId, messageId);
  if (!m || m.authorId !== authorId || m.deleted) return null;
  const t = text.trim().slice(0, MAX_TEXT_LEN);
  if (!t) return null;
  m.text = t;
  m.edited = true;
  scheduleSave();
  return m;
}

export function chatMessages(chatId: string, before?: number, limit = 50): Message[] {
  const c = getChat(chatId);
  if (!c) return [];
  const all = before ? c.messages.filter((m) => m.ts < before) : c.messages;
  return all.slice(-Math.max(1, Math.min(100, limit)));
}

export function unreadCount(chatId: string, userId: string): number {
  const c = getChat(chatId);
  if (!c) return 0;
  const upTo = READ_UP_TO[chatId] ?? 0;
  let n = 0;
  for (const m of c.messages) {
    if (m.authorId !== userId && m.ts > upTo) n++;
  }
  return n;
}

export function leaveChat(chatId: string, userId: string): { removed: boolean; deleted: boolean } {
  const c = getChat(chatId);
  if (!c || !c.members.includes(userId)) return { removed: false, deleted: false };
  c.members = c.members.filter((m) => m !== userId);
  const deleted = c.members.length === 0;
  if (deleted) {
    const idx = CHATS.findIndex((x) => x.id === chatId);
    if (idx !== -1) CHATS.splice(idx, 1);
    delete READ_UP_TO[chatId];
  }
  scheduleSave();
  return { removed: true, deleted };
}

export function deleteChat(chatId: string): boolean {
  const idx = CHATS.findIndex((c) => c.id === chatId);
  if (idx === -1) return false;
  CHATS.splice(idx, 1);
  delete READ_UP_TO[chatId];
  scheduleSave();
  return true;
}

export function isChatMember(chatId: string, userId: string): boolean {
  return getChat(chatId)?.members.includes(userId) ?? false;
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

  const existing = ids.length === 2 ? CHATS.find((c) => c.members.length === 2 && c.members.every((m) => ids.includes(m))) : undefined;
  if (existing) return existing;

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

// ---------- Друзья ----------

export interface FriendData {
  friends: User[];
  incoming: User[];
  outgoing: User[];
}

export function friendData(userId: string): FriendData {
  const friends = FRIEND_PAIRS.filter((p) => p.a === userId || p.b === userId)
    .map((p) => (p.a === userId ? userById(p.b) : userById(p.a)))
    .filter((u): u is FullUser => !!u)
    .map(publicUser);
  const incoming = FRIEND_REQUESTS.filter((r) => r.to === userId)
    .map((r) => userById(r.from))
    .filter((u): u is FullUser => !!u)
    .map(publicUser);
  const outgoing = FRIEND_REQUESTS.filter((r) => r.from === userId)
    .map((r) => userById(r.to))
    .filter((u): u is FullUser => !!u)
    .map(publicUser);
  return { friends, incoming, outgoing };
}

export function isFriend(a: string, b: string): boolean {
  return areFriends(a, b);
}

export function sendFriendRequest(fromId: string, toId: string): boolean {
  if (fromId === toId) return false;
  if (!userById(toId)) return false;
  if (areFriends(fromId, toId)) return false;
  if (pendingRequest(fromId, toId)) return false;
  const dup = FRIEND_REQUESTS.find((r) => r.from === toId && r.to === fromId);
  if (dup) {
    // встречная заявка -> сразу друзья
    FRIEND_REQUESTS.splice(FRIEND_REQUESTS.indexOf(dup), 1);
    FRIEND_PAIRS.push({ a: fromId, b: toId });
    scheduleSave();
    return true;
  }
  FRIEND_REQUESTS.push({ from: fromId, to: toId, ts: Date.now() });
  scheduleSave();
  return true;
}

export function acceptFriendRequest(toId: string, fromId: string): boolean {
  const idx = FRIEND_REQUESTS.findIndex((r) => r.from === fromId && r.to === toId);
  if (idx === -1) return false;
  FRIEND_REQUESTS.splice(idx, 1);
  if (!areFriends(fromId, toId)) FRIEND_PAIRS.push({ a: fromId, b: toId });
  scheduleSave();
  return true;
}

export function declineFriendRequest(toId: string, fromId: string): boolean {
  const idx = FRIEND_REQUESTS.findIndex((r) => r.from === fromId && r.to === toId);
  if (idx === -1) return false;
  FRIEND_REQUESTS.splice(idx, 1);
  scheduleSave();
  return true;
}

export function cancelFriendRequest(fromId: string, toId: string): boolean {
  const idx = FRIEND_REQUESTS.findIndex((r) => r.from === fromId && r.to === toId);
  if (idx === -1) return false;
  FRIEND_REQUESTS.splice(idx, 1);
  scheduleSave();
  return true;
}

export function removeFriend(a: string, b: string): boolean {
  const idx = FRIEND_PAIRS.findIndex((p) => pairKey(p.a, p.b) === pairKey(a, b));
  if (idx === -1) return false;
  FRIEND_PAIRS.splice(idx, 1);
  scheduleSave();
  return true;
}

export type { ReactionMap };