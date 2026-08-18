import { useEffect, useRef, useState } from "react";
import { Attachment, EMOJI_LIST, Message, ReplyRef } from "../types";
import { uploadFile } from "../api";

interface ComposerProps {
  replyTo: ReplyRef | null;
  editMsg: Message | null;
  onSend: (text: string, replyTo?: ReplyRef | null, attach?: Attachment | null) => void;
  myId: string;
  onTyping: (typing: boolean) => void;
  onCancelReply: () => void;
  onEditSubmit: (text: string) => void;
  onCancelEdit: () => void;
}

export default function Composer({
  replyTo,
  editMsg,
  onSend,
  myId,
  onTyping,
  onCancelReply,
  onEditSubmit,
  onCancelEdit,
}: ComposerProps) {
  const [value, setValue] = useState("");
  const [attach, setAttach] = useState<Attachment | null>(null);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editMsg) {
      setValue(editMsg.text);
      inputRef.current?.focus();
      resize();
    }
  }, [editMsg]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [replyTo?.id]);

  useEffect(() => {
    resize();
  }, [value]);

  useEffect(() => {
    if (!emojiOpen) return;
    const close = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setEmojiOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [emojiOpen]);

  const resize = () => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  };

  const insertEmoji = (e: string) => {
    const ta = inputRef.current;
    const start = ta?.selectionStart ?? value.length;
    const end = ta?.selectionEnd ?? value.length;
    setValue(value.slice(0, start) + e + value.slice(end));
    requestAnimationFrame(() => {
      ta?.focus();
      const pos = start + e.length;
      try {
        ta?.setSelectionRange(pos, pos);
      } catch {
        return;
      }
    });
  };

  const notifyTyping = () => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    onTyping(true);
    typingTimer.current = setTimeout(() => {
      onTyping(false);
      typingTimer.current = null;
    }, 1500);
  };

  const canSubmit = Boolean(value.trim() || attach);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (sending || !canSubmit) return;
    if (editMsg) {
      const text = value.trim();
      if (!text) return;
      onEditSubmit(text);
      setValue("");
      setAttach(null);
      onCancelEdit();
      return;
    }
    const text = value.trim();
    setSending(true);
    setErr(null);
    try {
      onSend(text, replyTo, attach);
      setValue("");
      setAttach(null);
      onCancelReply();
      if (typingTimer.current) clearTimeout(typingTimer.current);
      onTyping(false);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Не удалось отправить");
    } finally {
      setSending(false);
    }
  };

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setSending(true);
    setErr(null);
    try {
      const att = await uploadFile(file);
      setAttach(att);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Не удалось загрузить файл");
    } finally {
      setSending(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const editing = Boolean(editMsg);

  return (
    <div className="composer-wrap">
      {replyTo && !editing && (
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
      {editMsg && (
        <div className="reply-bar editing-bar">
          <span className="reply-bar-author">Редактирование сообщения</span>
          <span className="reply-bar-text">{editMsg.text.slice(0, 80)}</span>
          <button className="reply-bar-close" onClick={() => { onCancelEdit(); setValue(""); setAttach(null); }} title="Отменить правку" aria-label="Отменить правку">
            ✕
          </button>
        </div>
      )}
      <form className="composer" onSubmit={submit}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.txt,.zip,.xls,.xlsx"
          hidden
          onChange={(e) => void pickFile(e.target.files?.[0])}
        />
        {attach && (
          <div className="attach-preview">
            {attach.kind === "image" ? (
              <img src={attach.url} alt="превью" />
            ) : (
              <span className="attach-preview-file">📎 {attach.name}</span>
            )}
            <button type="button" className="reply-bar-close" onClick={() => setAttach(null)} aria-label="Убрать файл">
              ✕
            </button>
          </div>
        )}
        <button
          type="button"
          className="attach-btn"
          title="Прикрепить файл"
          aria-label="Прикрепить файл"
          onClick={() => fileRef.current?.click()}
          disabled={sending || editing}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        <div className="emoji-wrap" ref={emojiRef}>
          <button
            type="button"
            className={`emoji-btn ${emojiOpen ? "active" : ""}`}
            title="Эмодзи"
            aria-label="Эмодзи"
            onClick={() => setEmojiOpen((v) => !v)}
            disabled={sending || editing}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </button>
          {emojiOpen && (
            <div className="emoji-panel">
              {EMOJI_LIST.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="emoji-cell"
                  onClick={() => insertEmoji(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
        <textarea
          ref={inputRef}
          rows={1}
          value={value}
          placeholder={editing ? "Отредактируйте сообщение..." : "Написать сообщение..."}
          autoComplete="off"
          onChange={(e) => {
            setValue(e.target.value);
            notifyTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
          }}
        />
        <button
          className={`send-btn ${editing ? "edit-send" : ""}`}
          type="submit"
          disabled={!canSubmit || sending}
          title={editing ? "Сохранить" : "Отправить"}
          aria-label={editing ? "Сохранить" : "Отправить"}
        >
          {editing ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" />
              <path d="M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          )}
        </button>
      </form>
      {err && <div className="composer-err">{err}</div>}
    </div>
  );
}