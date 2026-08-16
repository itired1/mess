import { useEffect, useRef, useState } from "react";
import { ReplyRef } from "../types";

interface ComposerProps {
  replyTo: ReplyRef | null;
  onSend: (text: string, replyTo?: ReplyRef | null) => void;
  myId: string;
  onTyping: (typing: boolean) => void;
  onCancelReply: () => void;
}

export default function Composer({ replyTo, onSend, myId, onTyping, onCancelReply }: ComposerProps) {
  const [value, setValue] = useState("");
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [replyTo?.id]);

  const notifyTyping = () => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    onTyping(true);
    typingTimer.current = setTimeout(() => {
      onTyping(false);
      typingTimer.current = null;
    }, 1500);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = value.trim();
    if (!text) return;
    onSend(text, replyTo);
    setValue("");
    onCancelReply();
    if (typingTimer.current) clearTimeout(typingTimer.current);
    onTyping(false);
  };

  return (
    <div className="composer-wrap">
      {replyTo && (
        <div className="reply-bar">
          <span className="reply-bar-author">
            {replyTo.authorId === myId ? "Вы" : replyTo.authorName || "Собеседник"}
          </span>
          <span className="reply-bar-text">{replyTo.text}</span>
          <button className="reply-bar-close" onClick={onCancelReply} title="Отменить ответ" aria-label="Отменить ответ">
            ✕
          </button>
        </div>
      )}
      <form className="composer" onSubmit={submit}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          placeholder="Написать сообщение..."
          autoComplete="off"
          onChange={(e) => {
            setValue(e.target.value);
            notifyTyping();
          }}
        />
        <button className="send-btn" type="submit" disabled={!value.trim()} title="Отправить" aria-label="Отправить">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13" />
            <path d="M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </form>
    </div>
  );
}