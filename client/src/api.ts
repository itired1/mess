import { io, Socket } from "socket.io-client";
import { Chat, ChatSummary, Message, ReplyRef, User } from "./types";

const DEFAULT_URL =
  typeof location !== "undefined" && location.origin && !location.origin.startsWith("file:")
    ? location.origin
    : "http://localhost:4000";
const SERVER_URL = import.meta.env.VITE_SERVER_URL || DEFAULT_URL;
const TOKEN_KEY = "lb_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function authFetch(input: string, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
  };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (init?.body) headers["Content-Type"] = "application/json";
  return fetch(`${SERVER_URL}${input}`, { ...init, headers });
}

let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (socket) return socket;
  socket = io(SERVER_URL, {
    transports: ["websocket", "polling"],
    auth: { token: getToken() },
  });
  return socket;
}

export function getSocket(): Socket {
  if (!socket) connectSocket();
  return socket as Socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export function logout() {
  clearToken();
  disconnectSocket();
}

export async function register(name: string, password: string): Promise<User> {
  const res = await fetch(`${SERVER_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, password }),
  });
  const data = await res.json().catch(() => ({ error: "Сервер не отвечает" }));
  if (!res.ok) throw new Error(data.error ?? "Не удалось зарегистрироваться");
  setToken(data.token);
  return data.user as User;
}

export async function login(name: string, password: string): Promise<User> {
  const res = await fetch(`${SERVER_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, password }),
  });
  const data = await res.json().catch(() => ({ error: "Сервер не отвечает" }));
  if (!res.ok) throw new Error(data.error ?? "Не удалось войти");
  setToken(data.token);
  return data.user as User;
}

export async function fetchMe(): Promise<User> {
  const res = await authFetch("/api/auth/me");
  const data = await res.json().catch(() => ({ error: "Сервер не отвечает" }));
  if (!res.ok) throw new Error(data.error ?? "Сессия недействительна");
  return data.user as User;
}

export interface ProfileUpdate {
  avatar?: string;
  banner?: string;
}

export async function checkName(name: string): Promise<{ available: boolean; reason?: string }> {
  const res = await fetch(`${SERVER_URL}/api/auth/check-name?name=${encodeURIComponent(name)}`);
  if (!res.ok) return { available: false, reason: "error" };
  return res.json();
}

export async function updateProfile(payload: ProfileUpdate): Promise<User> {
  const res = await authFetch("/api/profile", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({ error: "Сервер не отвечает" }));
  if (!res.ok) throw new Error(data.error ?? "Не удалось сохранить профиль");
  return data as User;
}

export async function fetchUsers(): Promise<User[]> {
  const res = await authFetch("/api/users");
  if (!res.ok) throw new Error("Не удалось загрузить пользователей");
  return res.json();
}

export async function fetchChats(): Promise<ChatSummary[]> {
  const res = await authFetch("/api/chats");
  if (!res.ok) throw new Error("Не удалось загрузить чаты");
  return res.json();
}

export async function fetchChat(id: string): Promise<Chat> {
  const res = await authFetch(`/api/chats/${id}`);
  if (!res.ok) throw new Error("Не удалось загрузить чат");
  return res.json();
}

export function sendMessageSocket(
  chatId: string,
  text: string,
  replyTo?: ReplyRef | null
): Promise<Message> {
  return new Promise((resolve, reject) => {
    getSocket().emit("message:send", { chatId, text, replyTo }, (msg: Message | null | undefined) => {
      if (msg) resolve(msg);
      else reject(new Error("Не удалось отправить"));
    });
  });
}

export function emitTyping(chatId: string, typing: boolean) {
  getSocket().emit("typing", { chatId, typing });
}

export function emitReact(chatId: string, messageId: string, emoji: string) {
  getSocket().emit("message:react", { chatId, messageId, emoji });
}

export function emitDelete(chatId: string, messageId: string) {
  getSocket().emit("message:delete", { chatId, messageId });
}

export function emitRead(chatId: string) {
  getSocket().emit("chat:read", { chatId });
}

export function joinChat(chatId: string) {
  getSocket().emit("chat:join", chatId);
}

export function leaveChat(chatId: string) {
  getSocket().emit("chat:leave", chatId);
}

export async function createChat(name: string, memberIds: string[]): Promise<Chat> {
  const res = await authFetch("/api/chats", {
    method: "POST",
    body: JSON.stringify({ name, memberIds }),
  });
  if (!res.ok) throw new Error("Не удалось создать чат");
  return res.json();
}