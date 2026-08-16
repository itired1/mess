import Avatar from "./Avatar";

interface ChatItemProps {
  id: string;
  name: string;
  gradient: string;
  online: boolean;
  unread: number;
  lastMessage: { authorId: string; text: string; ts: number } | null;
  active: boolean;
  onSelect: (id: string) => void;
  meId: string;
  avatarSrc?: string | null;
}

function timeLabel(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const hh = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (sameDay) return hh;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

export default function ChatItem({
  id,
  name,
  gradient,
  online,
  unread,
  lastMessage,
  active,
  onSelect,
  meId,
  avatarSrc,
}: ChatItemProps) {
  const preview = lastMessage
    ? `${lastMessage.authorId === meId ? "Вы: " : ""}${lastMessage.text}`
    : "Нет сообщений";

  return (
    <li className={`chat-item ${active ? "active" : ""}`} onClick={() => onSelect(id)}>
      <Avatar gradient={gradient} name={name} online={online} size={46} src={avatarSrc} />
      <div className="chat-meta">
        <div className="chat-name">{name}</div>
        <div className="chat-preview">{preview}</div>
      </div>
      <div className="chat-side">
        <span className="chat-time">{lastMessage ? timeLabel(lastMessage.ts) : ""}</span>
        {unread > 0 && <span className="chat-badge">{unread}</span>}
      </div>
    </li>
  );
}