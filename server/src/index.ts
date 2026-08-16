import crypto from "crypto";
import { fileURLToPath } from "url";
import path from "path";
import express from "express";
import http from "http";
import cors from "cors";
import fs from "fs";
import { Server } from "socket.io";
import {
  addChat,
  addMessage,
  CHATS,
  deleteMessage,
  getChat,
  getMessage,
  getUser,
  listUsers,
  loginUser,
  ONLINE,
  READ_UP_TO,
  registerUser,
  saveNow,
  toggleReaction,
  updateProfile,
} from "./store.js";
import { ChatSummary, NewChatInput, NewMessageInput } from "./types.js";

const PORT = Number(process.env.PORT || 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_ROOT = path.resolve(__dirname, "../../data");
const UPLOADS = path.join(DATA_ROOT, "uploads");
fs.mkdirSync(UPLOADS, { recursive: true });
app.use("/uploads", express.static(UPLOADS, { maxAge: "7d", immutable: true }));

const CLIENT_DIST = path.resolve(__dirname, "../../client/dist");
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CLIENT_ORIGIN },
});

// Сессии: token -> userId
const tokens = new Map<string, string>();

function issueToken(userId: string): string {
  const token = crypto.randomBytes(24).toString("hex");
  tokens.set(token, userId);
  return token;
}

function userIdFromRequest(req: express.Request): string | undefined {
  const header = req.headers.authorization ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  return tokens.get(token);
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

function summaryOf(id: string): ChatSummary | undefined {
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
    unread: 0,
    lastMessage,
  };
}

function emitChanged(chatId: string, messageId?: string) {
  if (messageId) {
    const m = getMessage(chatId, messageId);
    if (m) io.to(chatId).emit("message:changed", m);
  }
  io.to(chatId).emit("chats:updated", summaryOf(chatId));
}

// ---------- Аутентификация ----------

app.post("/api/auth/register", (req, res) => {
  const { name, password } = req.body ?? {};
  if (typeof name !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Не хватает данных" });
  }
  const user = registerUser(name, password);
  if (!user) {
    return res.status(409).json({
      error: name.trim() && password.length >= 4
        ? "Имя уже занято"
        : "Имя (до 24 симв.) и пароль (от 4 симв.) — обязательны",
    });
  }
  res.status(201).json({ user, token: issueToken(user.id) });
});

app.post("/api/auth/login", (req, res) => {
  const { name, password } = req.body ?? {};
  if (typeof name !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Не хватает данных" });
  }
  const user = loginUser(name, password);
  if (!user) {
    return res.status(401).json({ error: "Неверное имя или пароль" });
  }
  res.json({ user, token: issueToken(user.id) });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  const user = getUser(getUserId(req));
  if (!user) return res.status(404).json({ error: "Пользователь не найден" });
  res.json({ user });
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
  res.json(CHATS.filter((c) => c.members.includes(uid)).map((c) => summaryOf(c.id)).filter(Boolean));
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
  res.json(c.messages);
});

app.post("/api/chats/:id/messages", requireAuth, (req, res) => {
  const { text, replyTo } = req.body as NewMessageInput;
  const t = text?.trim();
  if (!t) return res.status(400).json({ error: "Пустое сообщение" });

  const msg = addMessage(req.params.id, getUserId(req), t, replyTo);
  if (!msg) return res.status(404).json({ error: "Чат не найден" });

  io.to(msg.chatId).emit("message:new", msg);
  io.to(msg.chatId).emit("chats:updated", summaryOf(msg.chatId));
  res.status(201).json(msg);
});

app.delete("/api/chats/:id/messages/:msgId", requireAuth, (req, res) => {
  const deleted = deleteMessage(req.params.id, req.params.msgId, getUserId(req));
  if (!deleted) return res.status(404).json({ error: "Сообщение не найдено" });
  emitChanged(req.params.id, deleted.id);
  res.json(deleted);
});

app.post("/api/chats/:id/messages/:msgId/react", requireAuth, (req, res) => {
  const { emoji } = req.body as { emoji?: string };
  if (!emoji) return res.status(400).json({ error: "Нет emoji" });
  const reacted = toggleReaction(req.params.id, req.params.msgId, emoji, getUserId(req));
  if (!reacted) return res.status(404).json({ error: "Сообщение не найдено" });
  emitChanged(req.params.id, reacted.id);
  res.json(reacted);
});

app.post("/api/chats", requireAuth, (req, res) => {
  const { name, memberIds } = req.body as NewChatInput;
  const c = addChat(getUserId(req), name || "", Array.isArray(memberIds) ? memberIds : []);
  res.status(201).json(c);
});

// ---------- Socket.IO ----------

io.use((socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  const uid = token ? tokens.get(token) : undefined;
  if (!uid) return next(new Error("unauthorized"));
  socket.data.userId = uid;
  next();
});

io.on("connection", (socket) => {
  const uid = socket.data.userId as string;
  ONLINE.add(uid);
  socket.on("disconnect", () => {
    ONLINE.delete(uid);
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
      io.to(chatId).emit("chats:updated", summaryOf(chatId));
      ack?.(msg);
    }
  );

  socket.on("message:react", ({ chatId, messageId, emoji }: { chatId: string; messageId: string; emoji: string }) => {
    const c = getChat(chatId);
    if (!c || !c.members.includes(uid)) return;
    const reacted = toggleReaction(chatId, messageId, emoji, uid);
    if (reacted) emitChanged(chatId, reacted.id);
  });

  socket.on("message:delete", ({ chatId, messageId }: { chatId: string; messageId: string }) => {
    const c = getChat(chatId);
    if (!c || !c.members.includes(uid)) return;
    const deleted = deleteMessage(chatId, messageId, uid);
    if (deleted) emitChanged(chatId, deleted.id);
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