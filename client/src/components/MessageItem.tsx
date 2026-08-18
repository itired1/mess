import { memo, useEffect, useRef, useState } from "react";
import { Fragment, ReactNode } from "react";
import { Attachment, Message, REACTION_EMOJIS } from "../types";
import { formatClock, renderInline } from "../lib/format";

function fmtSize(n: number): string {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`;
  return `${(n / (1024 * 1024)).toFixed(1)} МБ`;
}

function AttachView({ attach }: { attach: Attachment }) {
  if (attach.kind === "image") {
    return (
      <img
        className="attach-img"
        src={attach.url}
        alt={attach.name ?? "изображение"}
        draggable={false}
        loading="lazy"
        onClick={() => window.open(attach.url, "_blank", "noopener")}
      />
    );
  }
  return (
    <a className="attach-file" href={attach.url} target="_blank" rel="noreferrer">
      <span className="attach-file-ico">📎</span>
      <span className="attach-file-name">{attach.name ?? "файл"}</span>
      {attach.size != null && <span className="attach-file-size">{fmtSize(attach.size)}</span>}
    </a>
  );
}

interface MessageItemProps {
  message: Message;
  chatName: string;
  myId: string;
  own: boolean;
  showName: boolean;
  showTime: boolean;
  read: boolean;
  query: string | null;
  onReact: (chatId: string, messageId: string, emoji: string) => void;
  onReply: (msg: Message) => void;
  onDelete: (chatId: string, messageId: string) => void;
  onEdit: (msg: Message) => void;
}

function highlight(text: string, query: string): ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

const PICKER_EMOJIS = REACTION_EMOJIS;

function MessageItem({
  message,
  chatName,
  myId,
  own,
  showName,
  showTime,
  read,
  query,
  onReact,
  onReply,
  onDelete,
  onEdit,
}: MessageItemProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const close = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [pickerOpen]);

  const deleted = message.deleted;
  const reactions = message.reactions ? Object.entries(message.reactions).filter(([, ids]) => ids.length) : [];
  const mineReacted = (emoji: string) => message.reactions?.[emoji]?.includes(myId) ?? false;

  const renderText = (text: string) => {
    const parts = renderInline(text);
    return query ? (
      <>
        {parts.map((p, i) =>
          typeof p === "string" ? (
            <Fragment key={i}>{highlight(p, query)}</Fragment>
          ) : (
            <Fragment key={i}>{p}</Fragment>
          )
        )}
      </>
    ) : (
      parts
    );
  };

  return (
    <div className={`msg-row ${own ? "own" : "other"}`}>
      <div className="msg-actions">
        <div className="picker-wrap" ref={pickerRef}>
          <button className="mini-btn" title="Реакция" onClick={() => setPickerOpen((v) => !v)}>
            🙂
          </button>
          {pickerOpen && (
            <div className="reaction-picker">
              {PICKER_EMOJIS.map((e) => (
                <button
                  key={e}
                  className={mineReacted(e) ? "active" : ""}
                  onClick={() => {
                    onReact(message.chatId, message.id, e);
                    setPickerOpen(false);
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="mini-btn" title="Ответить" onClick={() => onReply(message)}>
          ↩
        </button>
        {own && !deleted && (
          <>
            <button className="mini-btn" title="Редактировать" onClick={() => onEdit(message)}>
              ✎
            </button>
            <button className="mini-btn danger" title="Удалить" onClick={() => onDelete(message.chatId, message.id)}>
              ✕
            </button>
          </>
        )}
      </div>

      <div className="msg">
        {showName && !own && (
          <span className="msg-name">{chatName}</span>
        )}
        {message.replyTo && !deleted && (
          <div className="reply-preview">
            <span className="reply-border" style={{ background: own ? "rgba(255,255,255,.55)" : "var(--accent-1)" }} />
            <div className="reply-body">
              <span className="reply-author">
                {message.replyTo.authorId === myId
                  ? "Вы"
                  : message.replyTo.authorName || chatName}
              </span>
              <span className="reply-text">{message.replyTo.text}</span>
            </div>
          </div>
        )}
        <div className="bubble">
          {deleted ? (
            <em className="deleted-text">Сообщение удалено</em>
          ) : (
            <>
              {message.attach && <AttachView attach={message.attach} />}
              {message.text && <div className="msg-text">{renderText(message.text)}</div>}
            </>
          )}
        </div>
        {showTime && (
          <span className="msg-time">
            {formatClock(message.ts)}
            {message.edited && !deleted && <span className="edited-mark"> · исправлено</span>}
            {own && !deleted && (
              <span className={`ticks ${read ? "read" : ""}`}>
                {read ? "\u2713\u2713" : "\u2713"}
              </span>
            )}
          </span>
        )}
        {reactions.length > 0 && (
          <div className="reactions">
            {reactions.map(([emoji, ids]) => (
              <button
                key={emoji}
                className={`reaction-chip ${mineReacted(emoji) ? "mine" : ""}`}
                onClick={() => onReact(message.chatId, message.id, emoji)}
                title={ids.join(", ")}
              >
                <span className="reaction-emoji">{emoji}</span>
                <span className="reaction-count">{ids.length}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(MessageItem);