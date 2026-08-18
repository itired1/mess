import { useState } from "react";
import { FriendData, User } from "../types";

interface NewChatModalProps {
  users: User[];
  friendData: FriendData | null;
  onRequestFriend: (userId: string) => void;
  onAcceptFriend: (userId: string) => void;
  onClose: () => void;
  onCreate: (name: string, memberIds: string[]) => void;
}

export default function NewChatModal({
  users,
  friendData,
  onRequestFriend,
  onAcceptFriend,
  onClose,
  onCreate,
}: NewChatModalProps) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() && selected.length === 0) return;
    onCreate(name, selected);
  };

  const statusOf = (id: string): "friend" | "incoming" | "outgoing" | "none" => {
    if (!friendData) return "none";
    if (friendData.friends.some((f) => f.id === id)) return "friend";
    if (friendData.incoming.some((f) => f.id === id)) return "incoming";
    if (friendData.outgoing.some((f) => f.id === id)) return "outgoing";
    return "none";
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Новый чат</h2>
        <form onSubmit={submit}>
          <input
            autoFocus
            type="text"
            value={name}
            placeholder="Название чата (необязательно)"
            onChange={(e) => setName(e.target.value)}
          />
          <div className="modal-users">
            {users.map((u) => {
              const st = statusOf(u.id);
              return (
                <div className="modal-user-row" key={u.id}>
                  <button
                    type="button"
                    className={`modal-user ${selected.includes(u.id) ? "selected" : ""}`}
                    onClick={() => toggle(u.id)}
                  >
                    <span className="avatar" style={{ background: u.gradient, width: 34, height: 34, fontSize: 13 }}>
                      {u.avatar ? <img src={u.avatar} alt={u.name} draggable={false} /> : u.name.charAt(0)}
                    </span>
                    <span>{u.name}</span>
                    <i className="check">✓</i>
                  </button>
                  {st === "friend" && <span className="friend-chip ok">друг</span>}
                  {st === "outgoing" && <span className="friend-chip wait">заявка отправлена</span>}
                  {st === "incoming" && (
                    <button type="button" className="friend-chip act" onClick={() => onAcceptFriend(u.id)}>Принять</button>
                  )}
                  {st === "none" && (
                    <button type="button" className="friend-chip add" onClick={() => onRequestFriend(u.id)}>+ в друзья</button>
                  )}
                </div>
              );
            })}
            {users.length === 0 && (
              <div className="modal-empty">
                Пока нет других пользователей. Пригласите друзей — каждый может зарегистрироваться.
              </div>
            )}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn primary" disabled={!name.trim() && selected.length === 0}>
              Создать
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}