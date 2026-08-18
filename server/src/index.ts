import crypto from "crypto";
import { fileURLToPath } from "url";
import path from "path";
import express from "express";
import http from "http";
import cors from "cors";
import fs from "fs";
import multer from "multer";
import { Server } from "socket.io";
import {
  addChat,
  addMessage,
  CHATS,
  checkPassword,
  chatMessages,
  createToken,
  deleteChat,
  deleteMessage,
  editMessage,
  getChat,
  getMessage,
  getUser,
  isNameTaken,
  LAST_SEEN,
  leaveChat,
  listUsers,
  loginUser,
  ONLINE,
  READ_UP_TO,
  registerUser,
  revokeToken,
  saveNow,
  toggleReaction,
  tokenUser,
  unreadCount,
  updateProfile,
} from "./store.js";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  friendData,
  removeFriend,
  sendFriendRequest,
} from "./store.js";
import { ChatSummary, NewChatInput, NewMessageInput } from "./types.js";

const PORT = Number(process.env.PORT || 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = process.env.DATA_ROOT ?? path.resolve(__dirname, "../../data");
const UPLOADS = process.env.UPLOADS_DIR ?? path.join(DATA_ROOT, "uploads");
fs.mkdirSync(UPLOADS, { recursive: true });
app.use("/uploads", express.static(UPLOADS, { maxAge: "7d", immutable: true }));

const CLIENT_DIST = process.env.CLIENT_DIST ?? path.resolve(__dirname, "../../client/dist");
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN },
});

// Сессии: токены хранятся в базе (переживают рестарт сервера)
function userIdFromRequest(req: express.Request): string | undefined {
  const header = req.headers.authorization ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  return tokenUser(token);
}

function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const uid = userIdFromRequest(req);
  if (!uid) {
    res.status(401).json({ error: "Нужна авторизация" });
    return;
  }
  (req as express.Request & { userId?: string }).userId = uid;
  next();
}

function getUserId(req: express.Request): string {
  return (req as express.Request & { userId?: string }).userId as string;
}

// ---------- Лимиты авторизации ----------

const authAttempts = new Map<string, { count: number; window: number }>();
const AUTH_WINDOW_MS = 10 * 60_000;
const AUTH_MAX_LOGIN = 60;
const AUTH_MAX_REGISTER = 30;

function authLimiterFor(ip: string, max: number): number | null {
  const now = Date.now();
  const rec = authAttempts.get(ip);
  if (!rec || rec.window < now) {
    authAttempts.set(ip, { count: 1, window: now + AUTH_WINDOW_MS });
    return null;
  }
  rec.count++;
  return rec.count > max ? rec.count : null;
}

function clearAuthLimit(ip: string) {
  authAttempts.delete(ip);
}

function authRateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const over = authLimiterFor(ip, AUTH_MAX_LOGIN);
  if (over !== null) {
    res.status(429).json({ error: "Слишком много попыток. Подождите пару минут" });
    return;
  }
  next();
}

function registerRateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const over = authLimiterFor(ip, AUTH_MAX_REGISTER);
  if (over !== null) {
    res.status(429).json({ error: "Слишком много регистраций. Подождите пару минут" });
    return;
  }
  next();
}

function summaryOf(id: string, uid: string): ChatSummary | undefined {
  const c = getChat(id);
  if (!c) return undefined;
  const lastMessage = c.messages[c.messages.length - 1] ?? null;
  return {
    id: c.id,
    name: c.name,
    gradient: c.gradient,
    members: c.members,
    memberCount: c.members.length,
    online: c.members.some((m) => ONLINE.has(m)),
    unread: unreadCount(id, uid),
    lastMessage,
  };
}

function emitChanged(uid: string, chatId: string, messageId?: string) {
  if (messageId) {
    const m = getMessage(chatId, messageId);
    if (m) io.to(chatId).emit("message:changed", m);
  }
  io.to(chatId).emit("chats:updated", summaryOf(chatId, uid));
}

// ---------- Аутентификация ----------

app.post("/api/auth/register", registerRateLimit, (req, res) => {
  const { name, password } = req.body ?? {};
  if (typeof name !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Не хватает данных" });
  }
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 24) {
    return res.status(400).json({ error: "Имя до 24 символов" });
  }
  if (isNameTaken(trimmed)) {
    return res.status(409).json({ error: "Имя уже занято" });
  }
  const check = checkPassword(password);
  if (!check.ok) {
    const fail = check.rules.find((r) => !r.ok);
    return res.status(400).json({ error: `Пароль слабоват: ${fail?.label.toLowerCase() ?? "усильте его"}` });
  }
  const user = registerUser(trimmed, password);
  if (!user) {
    return res.status(400).json({ error: "Что-то пошло не так, попробуйте ещё раз" });
  }
  res.status(201).json({ user, token: createToken(user.id) });
});

app.get("/api/auth/check-name", (req, res) => {
  const name = String((req.query as { name?: unknown }).name ?? "").trim();
  if (!name) return res.json({ available: false, reason: "empty" });
  if (name.length > 24) return res.json({ available: false, reason: "too_long" });
  res.json({ available: !isNameTaken(name), reason: "ok" });
});

app.post("/api/auth/login", authRateLimit, (req, res) => {
  const { name, password } = req.body ?? {};
  if (typeof name !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Не хватает данных" });
  }
  const user = loginUser(name, password);
  if (!user) {
    return res.status(401).json({ error: "Неверное имя или пароль" });
  }
  clearAuthLimit(req.ip || req.socket.remoteAddress || "unknown");
  res.json({ user, token: createToken(user.id) });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  const user = getUser(getUserId(req));
  if (!user) return res.status(404).json({ error: "Пользователь не найден" });
  res.json({ user });
});

app.post("/api/auth/logout", (req, res) => {
  const header = req.headers.authorization ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  if (token) revokeToken(token);
  res.json({ ok: true });
});

// ---------- Друзья ----------

app.get("/api/friends", requireAuth, (req, res) => {
  res.json(friendData(getUserId(req)));
});

app.post("/api/friends/request", requireAuth, (req, res) => {
  const me = getUserId(req);
  const { toUserId } = req.body ?? {};
  if (typeof toUserId !== "string") return res.status(400).json({ error: "Нет получателя" });
  const ok = sendFriendRequest(me, toUserId);
  if (!ok) return res.status(400).json({ error: "Нельзя: уже друзья, заявка уже есть или пользователь не найден" });
  io.emit("friends:updated", { userId: me });
  io.emit("friends:updated", { userId: toUserId });
  res.json({ ok: true });
});

app.post("/api/friends/accept", requireAuth, (req, res) => {
  const me = getUserId(req);
  const { fromUserId } = req.body ?? {};
  if (typeof fromUserId !== "string") return res.status(400).json({ error: "Нет отправителя" });
  const ok = acceptFriendRequest(me, fromUserId);
  if (!ok) return res.status(400).json({ error: "Заявка не найдена" });
  io.emit("friends:updated", { userId: me });
  io.emit("friends:updated", { userId: fromUserId });
  res.json({ ok: true });
});

app.post("/api/friends/decline", requireAuth, (req, res) => {
  const me = getUserId(req);
  const { fromUserId } = req.body ?? {};
  if (typeof fromUserId !== "string") return res.status(400).json({ error: "Нет отправителя" });
  declineFriendRequest(me, fromUserId);
  io.emit("friends:updated", { userId: me });
  io.emit("friends:updated", { userId: fromUserId });
  res.json({ ok: true });
});

app.post("/api/friends/cancel", requireAuth, (req, res) => {
  const me = getUserId(req);
  const { toUserId } = req.body ?? {};
  if (typeof toUserId !== "string") return res.status(400).json({ error: "Нет получателя" });
  cancelFriendRequest(me, toUserId);
  io.emit("friends:updated", { userId: me });
  io.emit("friends:updated", { userId: toUserId });
  res.json({ ok: true });
});

app.post("/api/friends/remove", requireAuth, (req, res) => {
  const me = getUserId(req);
  const { userId } = req.body ?? {};
  if (typeof userId !== "string") return res.status(400).json({ error: "Нет пользователя" });
  removeFriend(me, userId);
  io.emit("friends:updated", { userId: me });
  io.emit("friends:updated", { userId });
  res.json({ ok: true });
});

app.post("/api/profile", requireAuth, (req, res) => {
  const body = req.body ?? {};
  const me = getUser(getUserId(req));
  if (!me) return res.status(404).json({ error: "Пользователь не найден" });

  let avatar: string | null | undefined;
  let banner: string | null | undefined;

  if ("avatar" in body) {
    if (typeof body.avatar !== "string") return res.status(400).json({ error: "Неверный формат аватара" });
    if (body.avatar === "") {
      avatar = null;
    } else {
      const url = saveImage(body.avatar, "avatars", me.avatar);
      if (!url) return res.status(400).json({ error: "Аватар: нужен PNG/JPEG/WebP/GIF до 6 МБ" });
      avatar = url;
    }
  }

  if ("banner" in body) {
    if (typeof body.banner !== "string") return res.status(400).json({ error: "Неверный формат баннера" });
    if (body.banner === "") {
      banner = null;
    } else {
      const url = saveImage(body.banner, "banners", me.banner);
      if (!url) return res.status(400).json({ error: "Баннер: нужен PNG/JPEG/WebP/GIF до 6 МБ" });
      banner = url;
    }
  }

  const user = updateProfile(me.id, { avatar, banner });
  if (!user) return res.status(404).json({ error: "Пользователь не найден" });
  io.emit("profile:updated", user);
  res.json(user);
});

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
const MAX_IMG_BYTES = 6 * 1024 * 1024;

function saveImage(dataUrl: string, sub: string, oldUrl?: string | null): string | null {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  const ext = EXT_BY_MIME[m[1].toLowerCase()];
  if (!ext) return null;
  let buf: Buffer;
  try {
    buf = Buffer.from(m[2], "base64");
  } catch {
    return null;
  }
  if (buf.length === 0 || buf.length > MAX_IMG_BYTES) return null;

  const name = `${sub}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const dir = path.join(UPLOADS, sub);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), buf);

  if (oldUrl && oldUrl.startsWith("/uploads/")) {
    const oldPath = path.join(UPLOADS, oldUrl.slice("/uploads/".length));
    try {
      if (oldPath.startsWith(UPLOADS)) fs.unlinkSync(oldPath);
    } catch {
      /* файл уже удалён */
    }
  }
  return `/uploads/${sub}/${name}`;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// ---------- REST ----------

app.get("/api/users", requireAuth, (req, res) => {
  res.json(listUsers(getUserId(req)));
});

app.get("/api/chats", requireAuth, (req, res) => {
  const uid = getUserId(req);
  res.json(CHATS.filter((c) => c.members.includes(uid)).map((c) => summaryOf(c.id, uid)).filter(Boolean));
});

app.get("/api/chats/:id", requireAuth, (req, res) => {
  const c = getChat(req.params.id);
  if (!c) return res.status(404).json({ error: "Чат не найден" });
  if (!c.members.includes(getUserId(req))) {
    return res.status(403).json({ error: "Нет доступа к чату" });
  }
  res.json(c);
});

app.get("/api/chats/:id/messages", requireAuth, (req, res) => {
  const c = getChat(req.params.id);
  if (!c) return res.status(404).json({ error: "Чат не найден" });
  if (!c.members.includes(getUserId(req))) {
    return res.status(403).json({ error: "Нет доступа к чату" });
  }
  const before = Number(req.query.before ?? NaN);
  const limit = Number(req.query.limit ?? 50);
  res.json(
    chatMessages(
      req.params.id,
      Number.isFinite(before) ? before : undefined,
      Number.isFinite(limit) ? limit : 50
    )
  );
});

app.post("/api/chats/:id/messages", requireAuth, (req, res) => {
  const { text, replyTo, attach } = req.body as NewMessageInput;
  const t = text?.trim();
  if (!t && !attach) return res.status(400).json({ error: "Пустое сообщение" });

  const msg = addMessage(req.params.id, getUserId(req), t ?? "", replyTo, attach);
  if (!msg) return res.status(404).json({ error: "Чат не найден" });

  io.to(msg.chatId).emit("message:new", msg);
  io.to(msg.chatId).emit("chats:updated", summaryOf(msg.chatId, getUserId(req)));
  res.status(201).json(msg);
});

app.patch("/api/chats/:id/messages/:msgId", requireAuth, (req, res) => {
  const { text } = req.body as { text?: string };
  const edited = editMessage(req.params.id, req.params.msgId, getUserId(req), text ?? "");
  if (!edited) return res.status(404).json({ error: "Сообщение не найдено" });
  emitChanged(getUserId(req), req.params.id, edited.id);
  res.json(edited);
});

app.delete("/api/chats/:id/messages/:msgId", requireAuth, (req, res) => {
  const deleted = deleteMessage(req.params.id, req.params.msgId, getUserId(req));
  if (!deleted) return res.status(404).json({ error: "Сообщение не найдено" });
  emitChanged(getUserId(req), req.params.id, deleted.id);
  res.json(deleted);
});

app.post("/api/chats/:id/messages/:msgId/react", requireAuth, (req, res) => {
  const { emoji } = req.body as { emoji?: string };
  if (!emoji) return res.status(400).json({ error: "Нет emoji" });
  const reacted = toggleReaction(req.params.id, req.params.msgId, emoji, getUserId(req));
  if (!reacted) return res.status(404).json({ error: "Сообщение не найдено" });
  emitChanged(getUserId(req), req.params.id, reacted.id);
  res.json(reacted);
});

app.post("/api/chats", requireAuth, (req, res) => {
  const { name, memberIds } = req.body as NewChatInput;
  const c = addChat(getUserId(req), name || "", Array.isArray(memberIds) ? memberIds : []);
  res.status(201).json(c);
});

// ---------- Вложения ----------

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
const MAX_FILE_BYTES = 20 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
});

app.post("/api/upload", requireAuth, upload.single("file"), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "Файл не передан" });
  const ext = (path.extname(file.originalname || "").slice(1) || "").toLowerCase().slice(0, 8);
  const isImage = file.mimetype.startsWith("image/") || IMAGE_EXT.has(ext);
  const name = `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext || (isImage ? "img" : "bin")}`;
  const dir = isImage ? path.join(UPLOADS, "images") : path.join(UPLOADS, "files");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), file.buffer);

  let w: number | undefined;
  let h: number | undefined;
  if (isImage) {
    try {
      const header = file.buffer.subarray(0, 8).toString("hex");
      if (header.startsWith("89504e470d0a1a0a")) {
        w = file.buffer.readUInt32BE(16);
        h = file.buffer.readUInt32BE(20);
      } else if (header.slice(0, 4) === "ffd8ff") {
        // размеры JPEG: ищем SOF-маркеры
        let off = 2;
        const buf = file.buffer;
        while (off + 9 < buf.length) {
          if (buf[off] !== 0xff) { off++; continue; }
          const marker = buf[off + 1];
          if (marker === 0xc0 || (marker >= 0xc1 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7)) {
            h = buf.readUInt16BE(off + 5);
            w = buf.readUInt16BE(off + 7);
            break;
          }
          off += 2 + buf.readUInt16BE(off + 2);
        }
      } else if (header.slice(0, 4) === "524946" && file.buffer.subarray(8, 12).toString("ascii") === "WEBP") {
        // WEBP: VP8X (4 байта: 24-bit ширина/высота)
        const wb = file.buffer.subarray(0, 80);
        const chunk = wb.indexOf(Buffer.from("VP8X"));
        if (chunk !== -1 && chunk + 18 <= wb.length) {
          w = wb.readUIntLE(chunk + 12, 3);
          h = wb.readUIntLE(chunk + 15, 3);
        }
      }
    } catch {
      /* размеры не критичны */
    }
  }

  res.status(201).json({
    url: `${isImage ? "/uploads/images/" : "/uploads/files/"}${name}`,
    kind: isImage ? "image" : "file",
    name: file.originalname || name,
    size: file.size,
    ...(isImage && w && h ? { w, h } : {}),
  });
});

// ---------- Управление чатом ----------

app.post("/api/chats/:id/leave", requireAuth, (req, res) => {
  const uid = getUserId(req);
  const chatId = req.params.id;
  const c = getChat(chatId);
  if (!c || !c.members.includes(uid)) return res.status(404).json({ error: "Чат не найден" });
  const members = [...c.members];
  const result = leaveChat(chatId, uid);
  if (!result.removed) return res.status(404).json({ error: "Чат не найден" });
  for (const m of members) {
    if (m !== uid) io.to(m).emit("chats:updated", summaryOf(chatId, m));
  }
  io.in(chatId).socketsLeave(chatId);
  res.json({ ok: true, deleted: result.deleted });
});

app.delete("/api/chats/:id", requireAuth, (req, res) => {
  const uid = getUserId(req);
  const chatId = req.params.id;
  const c = getChat(chatId);
  if (!c || !c.members.includes(uid)) return res.status(404).json({ error: "Чат не найден" });
  const members = [...c.members];
  if (!deleteChat(chatId)) return res.status(404).json({ error: "Чат не найден" });
  for (const m of members) {
    io.to(m).emit("chat:deleted", { chatId });
  }
  io.in(chatId).socketsLeave(chatId);
  res.json({ ok: true });
});

// ---------- Socket.IO ----------

io.use((socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  const uid = token ? tokenUser(token) : undefined;
  if (!uid) return next(new Error("unauthorized"));
  socket.data.userId = uid;
  next();
});

io.on("connection", (socket) => {
  const uid = socket.data.userId as string;
  ONLINE.add(uid);
  io.emit("presence", { userId: uid, online: true, lastSeen: LAST_SEEN.get(uid) });
  socket.on("disconnect", () => {
    if (ONLINE.delete(uid)) {
      const seen = Date.now();
      LAST_SEEN.set(uid, seen);
      io.emit("presence", { userId: uid, online: false, lastSeen: seen });
    }
  });

  socket.on("chat:join", (chatId: string) => {
    const c = getChat(chatId);
    if (!c || !c.members.includes(uid)) return;
    socket.join(chatId);
  });

  socket.on("chat:leave", (chatId: string) => {
    socket.leave(chatId);
  });

  socket.on("chat:read", ({ chatId }: { chatId: string }) => {
    if (!getChat(chatId)?.members.includes(uid)) return;
    READ_UP_TO[chatId] = Date.now();
    saveNow();
    socket.to(chatId).emit("messages:read", { chatId, upToTs: READ_UP_TO[chatId] });
  });

  socket.on(
    "message:send",
    ({ chatId, text, replyTo }: NewMessageInput, ack?: (msg: unknown) => void) => {
      const t = text?.trim();
      if (!chatId || !t) return;
      const c = getChat(chatId);
      if (!c || !c.members.includes(uid)) return;
      const msg = addMessage(chatId, uid, t, replyTo);
      if (!msg) return;
      READ_UP_TO[chatId] = Date.now();
      saveNow();
      io.to(chatId).emit("message:new", msg);
      io.to(chatId).emit("messages:read", { chatId, upToTs: READ_UP_TO[chatId] });
      io.to(chatId).emit("chats:updated", summaryOf(chatId, uid));
      ack?.(msg);
    }
  );

  socket.on("message:react", ({ chatId, messageId, emoji }: { chatId: string; messageId: string; emoji: string }) => {
    const c = getChat(chatId);
    if (!c || !c.members.includes(uid)) return;
    const reacted = toggleReaction(chatId, messageId, emoji, uid);
    if (reacted) emitChanged(uid, chatId, reacted.id);
  });

  socket.on("message:delete", ({ chatId, messageId }: { chatId: string; messageId: string }) => {
    const c = getChat(chatId);
    if (!c || !c.members.includes(uid)) return;
    const deleted = deleteMessage(chatId, messageId, uid);
    if (deleted) emitChanged(uid, chatId, deleted.id);
  });

  socket.on("message:edit", ({ chatId, messageId, text }: { chatId: string; messageId: string; text: string }) => {
    const c = getChat(chatId);
    if (!c || !c.members.includes(uid)) return;
    const edited = editMessage(chatId, messageId, uid, text ?? "");
    if (edited) emitChanged(uid, chatId, edited.id);
  });

  socket.on("typing", ({ chatId, typing }: { chatId: string; typing: boolean }) => {
    if (!getChat(chatId)?.members.includes(uid)) return;
    socket.to(chatId).emit("typing", { chatId, userId: uid, typing });
  });
});

if (fs.existsSync(CLIENT_DIST)) {
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/socket.io")) return next();
    res.sendFile(path.join(CLIENT_DIST, "index.html"));
  });
}

server.listen(PORT, () => {
  console.log(`✅ lilbru-server готов на http://localhost:${PORT}`);
  console.log("   REST: /api/auth/{register,login,me}, /api/chats");
});