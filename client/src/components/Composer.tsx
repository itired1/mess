import { useEffect, useRef, useState } from "react";
import { Attachment, Message, ReplyRef } from "../types";
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
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editMsg) {
      setValue(editMsg.text);
      inputRef.current?.focus();
    }
  }, [editMsg]);

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
        <input
          ref={inputRef}
          type="text"
          value={value}
          placeholder={editing ? "Отредактируйте сообщение..." : "Написать сообщение..."}
          autoComplete="off"
          onChange={(e) => {
            setValue(e.target.value);
            notifyTyping();
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