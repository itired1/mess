import { ChatSummary, User } from "../types";
import ChatItem from "./ChatItem";
import Avatar from "./Avatar";

interface SidebarProps {
  chats: ChatSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onSearch: (q: string) => void;
  onNewChat: () => void;
  onSettings: () => void;
  onLogout: () => void;
  connected: boolean;
  me: User;
}

export default function Sidebar({
  chats,
  activeId,
  onSelect,
  onSearch,
  onNewChat,
  onSettings,
  onLogout,
  connected,
  me,
}: SidebarProps) {
  return (
    <aside className="sidebar glass">
      <header className="sidebar-header">
        <h1>
          lilbru<span>message</span>
        </h1>
        <div className="sidebar-actions">
          <button className="icon-btn" onClick={onLogout} title="Выйти" aria-label="Выйти">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
          <button className="icon-btn" onClick={onSettings} title="Настройки" aria-label="Настройки">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          <button className="icon-btn" onClick={onNewChat} title="Новый чат" aria-label="Новый чат">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </header>

      <div className="search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Поиск по чатам..."
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>

      <ul className="chat-list">
        {chats.map((c) => (
          <ChatItem
            key={c.id}
            id={c.id}
            name={c.name}
            gradient={c.gradient}
            online={c.online}
            unread={c.unread}
            lastMessage={c.lastMessage}
            active={c.id === activeId}
            onSelect={onSelect}
            meId={me.id}
          />
        ))}
        {chats.length === 0 && (
          <li className="chat-empty">Чатов пока нет — создайте свой</li>
        )}
      </ul>

      <footer className="sidebar-footer">
        <Avatar gradient={me.gradient} name={me.name} size={42} />
        <div>
          <div className="me-name">{me.name}</div>
          <div className={`me-status ${connected ? "connected" : ""}`}>
            <i className="fn-dot" />
            {connected ? "в сети" : "нет связи"}
          </div>
        </div>
      </footer>
    </aside>
  );
}