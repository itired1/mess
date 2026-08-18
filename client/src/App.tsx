import { useCallback, useEffect, useRef, useState } from "react";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  clearToken,
  connectSocket,
  createChat,
  declineFriendRequest,
  deleteChatRest,
  emitDelete,
  emitEdit,
  emitRead,
  emitReact,
  emitTyping,
  fetchChat,
  fetchChats,
  fetchFriends,
  fetchMe,
  fetchMessages,
  fetchUsers,
  joinChat,
  leaveChat,
  leaveChatRest,
  logout,
  removeFriend,
  sendFriendRequest,
  sendMessageSocket,
  sendMessageWithAttachment,
} from "./api";
import { Attachment, Chat, ChatSummary, FriendData, Message, ReplyRef, User } from "./types";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import NewChatModal from "./components/NewChatModal";
import Loader, { LoaderMode } from "./components/Loader";
import AnimSettings from "./components/AnimSettings";
import AuthScreen from "./components/AuthScreen";
import ProfileModal from "./components/ProfileModal";
import FriendsModal from "./components/FriendsModal";

type Theme = "light" | "dark";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<Record<string, User>>({});
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
    (document.documentElement.dataset.theme as Theme) || (localStorage.getItem("theme") as Theme) || "dark"
  );
  const [booted, setBooted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [friends, setFriends] = useState<FriendData | null>(null);
  const [editMsg, setEditMsg] = useState<Message | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [olderLoading, setOlderLoading] = useState(false);
  const [soundOn, setSoundOn] = useState(() => localStorage.getItem("lb_sound") !== "0");
  const [animMode, setAnimMode] = useState<LoaderMode>(() => {
    const v = localStorage.getItem("lb_anim");
    return v === "calm" || v === "off" ? v : "full";
  });
  const activeIdRef = useRef<string | null>(null);
  const olderLoadingRef = useRef(false);
  const activeChatRef = useRef<Chat | null>(null);
  const hasMoreRef = useRef(true);
  const soundOnRef = useRef(soundOn);

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  useEffect(() => {
    localStorage.setItem("lb_sound", soundOn ? "1" : "0");
  }, [soundOn]);

  function playBeep() {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.5);
      o.onended = () => {
        try {
          ctx.close();
        } catch {
          /* ок */
        }
      };
    } catch {
      /* без звука в этом браузере */
    }
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Подхватываем тему при старте (до mount App) и при возврате из AuthScreen
  useEffect(() => {
    if (!user) return;
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    const stored = saved ?? (document.documentElement.dataset.theme as "light" | "dark" | undefined) ?? "dark";
    setTheme(stored);
  }, [user]);

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
    hasMoreRef.current = true;
    setHasMore(true);
    setReplyTo(null);
    setEditMsg(null);
  }, []);

  const selectChat = useCallback(
    (id: string) => {
      if (id === activeIdRef.current) return;
      if (activeIdRef.current) leaveChat(activeIdRef.current);
      activeIdRef.current = id;
      olderLoadingRef.current = false;
      joinChat(id);
      emitRead(id);
      setChats((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
      void loadChatDetails(id);
    },
    [loadChatDetails]
  );

  const loadOlder = useCallback(async () => {
    const id = activeIdRef.current;
    if (!id || olderLoadingRef.current) return;
    const chat = activeChatRef.current;
    if (!chat || chat.messages.length === 0 || !(hasMoreRef.current)) return;
    const oldestTs = chat.messages[0].ts;
    olderLoadingRef.current = true;
    setOlderLoading(true);
    try {
      const older = await fetchMessages(id, oldestTs, 50);
      const len = older.length;
      const hasMoreNow = len === 50;
      hasMoreRef.current = hasMoreNow;
      setHasMore(hasMoreNow);
      setActiveChat((prev) =>
        prev && prev.id === id && len > 0 ? { ...prev, messages: [...older, ...prev.messages] } : prev
      );
    } catch (e) {
      console.error(e);
    } finally {
      olderLoadingRef.current = false;
      setOlderLoading(false);
    }
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    setUser(null);
    setBooted(false);
    setConnected(false);
    setChats([]);
    setActiveChat(null);
    setReplyTo(null);
    setFriends(null);
    activeIdRef.current = null;
  }, []);

  const loadFriends = useCallback(() => {
    fetchFriends()
      .then(setFriends)
      .catch(() => setFriends(null));
  }, []);

  const refreshFriends = useCallback((fn: () => Promise<void>) => {
    fn().then(loadFriends).catch(console.error);
  }, [loadFriends]);

  const handleFriendMessage = useCallback(
    async (u: User) => {
      try {
        const created = await createChat("", [u.id]);
        const list = await fetchChats();
        setChats(list);
        setShowFriends(false);
        selectChat(created.id);
      } catch (e) {
        console.error(e);
      }
    },
    [selectChat]
  );

  // Бутстрап после входа: сокет + чаты
  useEffect(() => {
    if (!user) return;

    setBooted(false);
    setChats([]);
    setActiveChat(null);
    setReadUpTo({});
    setConnected(false);

    const socket = connectSocket();

    fetchUsers()
      .then((list) => setUsers(Object.fromEntries(list.map((u) => [u.id, u]))))
      .catch(console.error);

    loadFriends();

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

    socket.on("profile:updated", (u: User) => {
      setUsers((prev) => ({ ...prev, [u.id]: u }));
      setUser((prev) => (prev && prev.id === u.id ? u : prev));
    });

    socket.on("friends:updated", loadFriends);

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
      } else if (msg.authorId !== user?.id && soundOnRef.current) {
        playBeep();
      }
    });

    socket.on("chat:deleted", ({ chatId }: { chatId: string }) => {
      setChats((prev) => prev.filter((c) => c.id !== chatId));
      if (activeIdRef.current === chatId) removeActiveChat();
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

  const handleSend = useCallback(
    (text: string, reply?: ReplyRef | null, attach?: Attachment | null) => {
      const id = activeIdRef.current;
      if (!id) return;
      emitTyping(id, false);
      if (attach) {
        void sendMessageWithAttachment(id, text, reply ?? null, attach).catch(console.error);
      } else {
        void sendMessageSocket(id, text, reply).catch(console.error);
      }
    },
    []
  );

  const handleEditSubmit = useCallback((text: string) => {
    const id = activeIdRef.current;
    const m = editMsg;
    if (!id || !m) return;
    emitEdit(id, m.id, text);
    setEditMsg(null);
  }, [editMsg]);

  const handleEditMessage = useCallback((m: Message) => {
    setEditMsg(m);
  }, []);

  const removeActiveChat = useCallback(() => {
    setActiveChat(null);
    setEditMsg(null);
    setReplyTo(null);
    activeIdRef.current = null;
  }, []);

  const handleLeaveChat = useCallback(
    async (id: string) => {
      try {
        const r = await leaveChatRest(id);
        if (!r.deleted) {
          const list = await fetchChats();
          setChats(list);
        } else {
          setChats((prev) => prev.filter((c) => c.id !== id));
        }
        if (activeIdRef.current === id) removeActiveChat();
      } catch (e) {
        console.error(e);
      }
    },
    [removeActiveChat]
  );

  const handleDeleteChat = useCallback(
    async (id: string) => {
      try {
        await deleteChatRest(id);
        setChats((prev) => prev.filter((c) => c.id !== id));
        if (activeIdRef.current === id) removeActiveChat();
      } catch (e) {
        console.error(e);
      }
    },
    [removeActiveChat]
  );

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

  const peerUserId = activeChat?.members.find((m) => m !== user?.id) ?? null;
  const peer = peerUserId ? users[peerUserId] ?? null : null;

  if (authBooting) {
    return <Loader ready={false} onDone={() => {}} mode={animMode} />;
  }

  if (!user) {
    return <AuthScreen onAuthed={(u) => { setUser(u); setBooted(false); }} />;
  }

  return (
    <>
      {!booted && (
        <Loader
          ready={ready}
          onDone={() => setBooted(true)}
          mode={animMode}
          friendAvatars={friends?.friends.map((f) => ({ name: f.name, gradient: f.gradient, avatar: f.avatar }))}
        />
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
        onOpenProfile={() => setShowProfile(true)}
        onOpenFriends={() => setShowFriends(true)}
        connected={connected}
        me={user}
        users={users}
      />

      {showSettings && (
        <AnimSettings
          mode={animMode}
          onChange={setAnimMode}
          sound={soundOn}
          onSoundChange={setSoundOn}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showProfile && user && (
        <ProfileModal
          user={user}
          onClose={() => setShowProfile(false)}
          onUpdated={(u) => {
            setUser((prev) => (prev && prev.id === u.id ? u : prev));
            setUsers((prev) => ({ ...prev, [u.id]: u }));
          }}
        />
      )}

      <ChatWindow
        chat={activeChat}
        isTyping={activeChat ? typingChatIds.has(activeChat.id) : false}
        readUpTo={activeChat ? readUpTo[activeChat.id] ?? 0 : 0}
        theme={theme}
        myId={user.id}
        peer={peer}
        onThemeToggle={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        replyTo={replyTo}
        onReplyTo={setReplyTo}
        onSend={handleSend}
        onTyping={emitTyping}
        onReact={handleReact}
        onDelete={handleDelete}
        editMsg={editMsg}
        onEditSubmit={handleEditSubmit}
        onEditMessage={handleEditMessage}
        onCancelEdit={() => setEditMsg(null)}
        onLoadOlder={loadOlder}
        hasMore={hasMore}
        olderLoading={olderLoading}
        onLeaveChat={handleLeaveChat}
        onDeleteChat={handleDeleteChat}
      />

      {showNewChat && (
        <NewChatModal
          users={newChatUsers}
          friendData={friends}
          onRequestFriend={(id) => refreshFriends(() => sendFriendRequest(id))}
          onAcceptFriend={(id) => refreshFriends(() => acceptFriendRequest(id))}
          onClose={() => setShowNewChat(false)}
          onCreate={handleNewChat}
        />
      )}

      {showFriends && user && friends && (
        <FriendsModal
          data={friends}
          onAccept={(id) => refreshFriends(() => acceptFriendRequest(id))}
          onDecline={(id) => refreshFriends(() => declineFriendRequest(id))}
          onCancel={(id) => refreshFriends(() => cancelFriendRequest(id))}
          onRemove={(id) => refreshFriends(() => removeFriend(id))}
          onMessage={handleFriendMessage}
          onClose={() => setShowFriends(false)}
        />
      )}
      </div>
    </>
  );
}