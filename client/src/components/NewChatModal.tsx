import { useState } from "react";
import { User } from "../types";

interface NewChatModalProps {
  users: User[];
  onClose: () => void;
  onCreate: (name: string, memberIds: string[]) => void;
}

export default function NewChatModal({ users, onClose, onCreate }: NewChatModalProps) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() && selected.length === 0) return;
    onCreate(name, selected);
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
            {users.map((u) => (
              <button
                key={u.id}
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
            ))}
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