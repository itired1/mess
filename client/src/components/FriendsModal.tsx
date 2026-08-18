import { FriendData, User } from "../types";
import Avatar from "./Avatar";

interface FriendsModalProps {
  data: FriendData;
  onAccept: (fromId: string) => void;
  onDecline: (fromId: string) => void;
  onCancel: (toId: string) => void;
  onRemove: (userId: string) => void;
  onMessage: (user: User) => void;
  onClose: () => void;
}

function Row({ user, right }: { user: User; right: React.ReactNode }) {
  return (
    <div className="friend-row">
      <Avatar gradient={user.gradient} name={user.name} size={38} src={user.avatar} />
      <div className="friend-name">
        <span>{user.name}</span>
        {user.online && <i className="friend-online" title="в сети" />}
      </div>
      <div className="friend-actions">{right}</div>
    </div>
  );
}

export default function FriendsModal({
  data,
  onAccept,
  onDecline,
  onCancel,
  onRemove,
  onMessage,
  onClose,
}: FriendsModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal friends-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Друзья</h2>

        {data.incoming.length > 0 && (
          <section className="friend-section">
            <h3>Заявки в друзья</h3>
            {data.incoming.map((u) => (
              <Row key={u.id} user={u} right={
                  <>
                    <button className="btn primary small" onClick={() => onAccept(u.id)}>Принять</button>
                    <button className="btn ghost small" onClick={() => onDecline(u.id)}>Отклонить</button>
                  </>
                }
              />
            ))}
          </section>
        )}

        {data.outgoing.length > 0 && (
          <section className="friend-section">
            <h3>Отправленные заявки</h3>
            {data.outgoing.map((u) => (
              <Row key={u.id} user={u} right={
                  <button className="btn ghost small" onClick={() => onCancel(u.id)}>Отменить</button>
                }
              />
            ))}
          </section>
        )}

        <section className="friend-section">
          <h3>Мои друзья</h3>
          {data.friends.length === 0 ? (
            <div className="modal-empty">Пока никого нет. Добавь друга через кнопку «+ в друзья» при создании чата.</div>
          ) : (
            data.friends.map((u) => (
              <Row key={u.id} user={u} right={
                  <>
                    <button className="btn primary small" onClick={() => onMessage(u)}>Написать</button>
                    <button className="btn ghost small danger" onClick={() => onRemove(u.id)}>Убрать</button>
                  </>
                }
              />
            ))
          )}
        </section>

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}
