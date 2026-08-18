import { useEffect, useState } from "react";
import { Attachment, Chat, Message, ReplyRef, User } from "../types";
import { lastSeenLabel } from "../lib/format";
import MessageList from "./MessageList";
import Composer from "./Composer";

interface ChatWindowProps {
  chat: Chat | null;
  isTyping: boolean;
  readUpTo: number;
  theme: "light" | "dark";
  myId: string;
  peer?: User | null;
  onThemeToggle: () => void;
  replyTo: ReplyRef | null;
  onReplyTo: (r: ReplyRef | null) => void;
  onSend: (text: string, replyTo?: ReplyRef | null, attach?: Attachment | null) => void;
  onTyping: (chatId: string, typing: boolean) => void;
  onReact: (chatId: string, messageId: string, emoji: string) => void;
  onDelete: (chatId: string, messageId: string) => void;
  editMsg: Message | null;
  onEditSubmit: (text: string) => void;
  onEditMessage: (msg: Message) => void;
  onCancelEdit: () => void;
  onLoadOlder: () => void;
  hasMore: boolean;
  olderLoading: boolean;
  onLeaveChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
}

export default function ChatWindow({
  chat,
  isTyping,
  readUpTo,
  theme,
  myId,
  peer,
  onThemeToggle,
  replyTo,
  onReplyTo,
  onSend,
  onTyping,
  onReact,
  onDelete,
  editMsg,
  onEditSubmit,
  onEditMessage,
  onCancelEdit,
  onLoadOlder,
  hasMore,
  olderLoading,
  onLeaveChat,
  onDeleteChat,
}: ChatWindowProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [jumpToId, setJumpToId] = useState<string | null>(null);
  const [matchIndex, setMatchIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const matches = chat
    ? chat.messages.map((m, i) => ({ m, i })).filter(({ m }) => m.text.toLowerCase().includes(query.toLowerCase()))
    : [];

  useEffect(() => {
    if (chat && !chat.messages.some((m) => m.id === jumpToId)) setJumpToId(null);
  }, [chat, jumpToId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setMatchIndex(0);
  }, [query, chat?.id]);

  const goToMatch = (dir: 1 | -1) => {
    if (matches.length === 0) return;
    const next = (matchIndex + dir + matches.length) % matches.length;
    setMatchIndex(next);
    setJumpToId(matches[next].m.id);
  };

  if (!chat) {
    return (
      <main className="chat glass empty-chat">
        <div className="empty">
          <span className="empty-icon">💬</span>
          <span>Выберите чат, чтобы начать общение</span>
        </div>
      </main>
    );
  }

  const peerOnline = chat.members.length === 2 && Boolean(peer?.online);

  const statusText = () => {
    if (chat.members.length > 2) return `${chat.memberCount || chat.members.length} участника`;
    if (peerOnline) return "в сети";
    return peer?.lastSeen ? lastSeenLabel(peer.lastSeen) : "был(а) недавно";
  };

  return (
    <main className="chat glass">
      <header className="chat-header">
        <span className="avatar" style={{ background: chat.gradient, width: 46, height: 46, fontSize: 17 }}>
          {peer?.avatar ? (
            <img src={peer.avatar} alt={peer.name} draggable={false} />
          ) : (
            chat.name.charAt(0)
          )}
          <i className={`status-dot ${peerOnline ? "on" : ""}`} />
        </span>
        <div className="chat-title">
          <div className="name">{chat.name}</div>
          <div className="status">
            <i className={`online-dot ${peerOnline ? "" : "off"}`} />
            <span>
              {statusText()}
            </span>
          </div>
        </div>
        <button
          className={`icon-btn ${searchOpen ? "active" : ""}`}
          title="Поиск (Ctrl+F)"
          onClick={() => setSearchOpen((v) => !v)}
          aria-label="Поиск"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </button>
        <button className="icon-btn" title={theme === "dark" ? "Светлая тема" : "Тёмная тема"} onClick={onThemeToggle} aria-label="Переключить тему">
          {theme === "dark" ? (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.42 1.42" />
            </svg>
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
        <div className="chat-menu-wrap">
          <button className="icon-btn" title="Ещё" aria-label="Ещё" onClick={() => setMenuOpen((v) => !v)}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>
          {menuOpen && (
            <div className="chat-menu">
              <button onClick={() => { setMenuOpen(false); onLeaveChat(chat.id); }}>Покинуть чат</button>
              <button className="danger" onClick={() => { setMenuOpen(false); onDeleteChat(chat.id); }}>Удалить чат</button>
            </div>
          )}
        </div>
      </header>

      {searchOpen && (
        <div className="search-bar">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            autoFocus
            type="text"
            value={query}
            placeholder="Поиск в этом чате..."
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <span className="search-count">
              {matches.length > 0 ? `${matchIndex + 1}/${matches.length}` : "0"}
            </span>
          )}
          <button className="mini-btn" onClick={() => goToMatch(-1)} title="Предыдущее" aria-label="Предыдущее">
            ↑
          </button>
          <button className="mini-btn" onClick={() => goToMatch(1)} title="Следующее" aria-label="Следующее">
            ↓
          </button>
        </div>
      )}

      <MessageList
        chat={chat}
        isTyping={isTyping}
        readUpTo={readUpTo}
        query={searchOpen ? query : ""}
        jumpToId={jumpToId}
        myId={myId}
        onReact={onReact}
        onReply={(m) => onReplyTo({ id: m.id, authorId: m.authorId, authorName: m.authorName, text: m.text })}
        onDelete={onDelete}
        onEdit={onEditMessage}
        onLoadOlder={onLoadOlder}
        hasMore={hasMore}
        olderLoading={olderLoading}
      />

      <Composer
        replyTo={replyTo}
        editMsg={editMsg}
        onSend={onSend}
        myId={myId}
        onTyping={(t) => onTyping(chat.id, t)}
        onCancelReply={() => onReplyTo(null)}
        onEditSubmit={onEditSubmit}
        onCancelEdit={onCancelEdit}
      />
    </main>
  );
}