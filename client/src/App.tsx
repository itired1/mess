import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearToken,
  connectSocket,
  createChat,
  emitDelete,
  emitRead,
  emitReact,
  emitTyping,
  fetchChat,
  fetchChats,
  fetchMe,
  fetchUsers,
  joinChat,
  leaveChat,
  logout,
  sendMessageSocket,
} from "./api";
import { Chat, ChatSummary, Message, ReplyRef, User } from "./types";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import NewChatModal from "./components/NewChatModal";
import Loader, { LoaderMode } from "./components/Loader";
import AnimSettings from "./components/AnimSettings";
import AuthScreen from "./components/AuthScreen";

type Theme = "light" | "dark";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authBooting, setAuthBooting] = useState(true);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [query, setQuery] = useState("");
  const [typingChatIds, setTypingChatIds] = useState<Set<string>>(new Set());
  const [readUpTo, setReadUpTo] = useState<Record<string, number>>({});
  const [connected, setConnected] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatUsers, setNewChatUsers] = useState<User[]>([]);
  const [replyTo, setReplyTo] = useState<ReplyRef | null>(null);
  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem("theme") === "dark" ? "dark" : "light"
  );
  const [booted, setBooted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [animMode, setAnimMode] = useState<LoaderMode>(() => {
    const v = localStorage.getItem("lb_anim");
    return v === "calm" || v === "off" ? v : "full";
  });
  const activeIdRef = useRef<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.anim = animMode;
    localStorage.setItem("lb_anim", animMode);
  }, [animMode]);

  // Проверяем сохранённую сессию
  useEffect(() => {
    const saved = localStorage.getItem("lb_token");
    if (!saved) {
      setAuthBooting(false);
      return;
    }
    fetchMe()
      .then((u) => setUser(u))
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => setAuthBooting(false));
  }, []);

  const patchMessage = useCallback((msg: Message) => {
    setActiveChat((prev) =>
      prev && prev.id === msg.chatId
        ? { ...prev, messages: prev.messages.map((m) => (m.id === msg.id ? msg : m)) }
        : prev
    );
  }, []);

  const loadChatDetails = useCallback(async (id: string) => {
    const chat = await fetchChat(id);
    setActiveChat(chat);
    setReplyTo(null);
  }, []);

  const selectChat = useCallback(
    (id: string) => {
      if (id === activeIdRef.current) return;
      if (activeIdRef.current) leaveChat(activeIdRef.current);
      activeIdRef.current = id;
      joinChat(id);
      emitRead(id);
      setChats((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
      void loadChatDetails(id);
    },
    [loadChatDetails]
  );

  const handleLogout = useCallback(() => {
    logout();
    setUser(null);
    setBooted(false);
    setConnected(false);
    setChats([]);
    setActiveChat(null);
    setReplyTo(null);
    activeIdRef.current = null;
  }, []);

  // Бутстрап после входа: сокет + чаты
  useEffect(() => {
    if (!user) return;

    setBooted(false);
    setChats([]);
    setActiveChat(null);
    setReadUpTo({});
    setConnected(false);

    const socket = connectSocket();

    fetchChats()
      .then((list) => {
        setChats(list);
        const first = list[0];
        if (first && !activeIdRef.current) selectChat(first.id);
      })
      .catch((e) => {
        if (e.message === "Сессия недействительна") handleLogout();
        console.error(e);
      });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));

    socket.on("message:new", (msg: Message) => {
      setChats((prev) =>
        prev.map((c) =>
          c.id === msg.chatId
            ? { ...c, lastMessage: msg, unread: c.id === activeIdRef.current ? 0 : c.unread + 1 }
            : c
        )
      );
      if (msg.chatId === activeIdRef.current) {
        setActiveChat((prev) => (prev ? { ...prev, messages: [...prev.messages, msg] } : prev));
      }
    });

    socket.on("message:changed", (msg: Message) => {
      patchMessage(msg);
    });
    socket.on("message:reacted", ({ message }: { message: Message }) => {
      patchMessage(message);
    });

    socket.on("messages:read", ({ chatId, upToTs }: { chatId: string; upToTs: number }) => {
      setReadUpTo((prev) => (prev[chatId] ?? 0) < upToTs ? { ...prev, [chatId]: upToTs } : prev);
    });

    socket.on("typing", ({ chatId, typing }: { chatId: string; typing: boolean }) => {
      setTypingChatIds((prev) => {
        const next = new Set(prev);
        if (typing) next.add(chatId);
        else next.delete(chatId);
        return next;
      });
    });

    socket.on("chats:updated", (summary: ChatSummary) => {
      setChats((prev) => prev.some((c) => c.id === summary.id) ? prev.map((c) => (c.id === summary.id ? summary : c)) : [...prev, summary]);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleSend = useCallback((text: string, reply?: ReplyRef | null) => {
    if (!activeIdRef.current) return;
    emitTyping(activeIdRef.current, false);
    void sendMessageSocket(activeIdRef.current, text, reply).catch(console.error);
  }, []);

  const handleReact = useCallback((chatId: string, messageId: string, emoji: string) => {
    emitReact(chatId, messageId, emoji);
  }, []);

  const handleDelete = useCallback((chatId: string, messageId: string) => {
    emitDelete(chatId, messageId);
  }, []);

  const handleNewChat = useCallback(async (name: string, memberIds: string[]) => {
    try {
      const created = await createChat(name, memberIds);
      const list = await fetchChats();
      setChats(list);
      setShowNewChat(false);
      selectChat(created.id);
    } catch (e) {
      console.error(e);
    }
  }, [selectChat]);

  const openNewChat = useCallback(() => {
    setShowNewChat(true);
    fetchUsers()
      .then(setNewChatUsers)
      .catch(() => setNewChatUsers([]));
  }, []);

  const filtered = query
    ? chats.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
    : chats;

  const ready = connected && activeChat !== null;

  if (authBooting) {
    return <Loader ready={false} onDone={() => {}} mode={animMode} />;
  }

  if (!user) {
    return <AuthScreen onAuthed={(u) => { setUser(u); setBooted(false); }} />;
  }

  return (
    <>
      {!booted && (
        <Loader ready={ready} onDone={() => setBooted(true)} mode={animMode} />
      )}
      <div className="app">
      <div className="bg-aurora">
        <span className="aurora a1" />
        <span className="aurora a2" />
        <span className="aurora a3" />
      </div>

      <Sidebar
        chats={filtered}
        activeId={activeChat?.id ?? null}
        onSelect={selectChat}
        onSearch={setQuery}
        onNewChat={openNewChat}
        onSettings={() => setShowSettings((s) => !s)}
        onLogout={handleLogout}
        connected={connected}
        me={user}
      />

      {showSettings && (
        <AnimSettings mode={animMode} onChange={setAnimMode} onClose={() => setShowSettings(false)} />
      )}

      <ChatWindow
        chat={activeChat}
        isTyping={activeChat ? typingChatIds.has(activeChat.id) : false}
        readUpTo={activeChat ? readUpTo[activeChat.id] ?? 0 : 0}
        theme={theme}
        myId={user.id}
        onThemeToggle={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        replyTo={replyTo}
        onReplyTo={setReplyTo}
        onSend={handleSend}
        onTyping={emitTyping}
        onReact={handleReact}
        onDelete={handleDelete}
      />

      {showNewChat && (
        <NewChatModal users={newChatUsers} onClose={() => setShowNewChat(false)} onCreate={handleNewChat} />
      )}
      </div>
    </>
  );
}