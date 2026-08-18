import { ReactNode, memo, useEffect, useMemo, useRef } from "react";
import { Chat, Message } from "../types";
import { formatDay } from "../lib/format";
import MessageItem from "./MessageItem";

const GROUP_GAP = 3 * 60_000;

interface MessageListProps {
  chat: Chat;
  isTyping: boolean;
  readUpTo: number;
  query: string;
  jumpToId: string | null;
  myId: string;
  onReact: (chatId: string, messageId: string, emoji: string) => void;
  onReply: (msg: Message) => void;
  onDelete: (chatId: string, messageId: string) => void;
  onEdit: (msg: Message) => void;
  onLoadOlder: () => void;
  hasMore: boolean;
  olderLoading: boolean;
}

function TypingBubble() {
  return (
    <div className="msg-row other">
      <div className="msg">
        <div className="bubble typing-bubble">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    </div>
  );
}

function isGroupEdge(a: Message | undefined, b: Message): boolean {
  if (!a) return true;
  if (a.authorId !== b.authorId) return true;
  return b.ts - a.ts >= GROUP_GAP;
}

export default memo(function MessageList({
  chat,
  isTyping,
  readUpTo,
  query,
  jumpToId,
  myId,
  onReact,
  onReply,
  onDelete,
  onEdit,
  onLoadOlder,
  hasMore,
  olderLoading,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCount = useRef(chat.messages.length);
  const loadOlderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const olderScroll = useRef<number | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (chat.messages.length > prevCount.current) {
      if (olderScroll.current !== null) {
        // добавились старшие сообщения — сохраняем позицию
        const delta = el.scrollHeight - olderScroll.current;
        el.scrollTop += delta;
        olderScroll.current = null;
      } else {
        el.scrollTop = el.scrollHeight;
      }
      prevCount.current = chat.messages.length;
    }
  }, [chat.messages.length]);

  // подгрузка старших: сохраняем позицию прокрутки
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    prevCount.current = chat.messages.length;
    const onScroll = () => {
      if (el.scrollTop < 60 && hasMore && !olderLoading) {
        if (loadOlderTimer.current) return;
        olderScroll.current = el.scrollHeight;
        loadOlderTimer.current = setTimeout(() => {
          loadOlderTimer.current = null;
          onLoadOlder();
        }, 250);
      }
    };
    el.addEventListener("scroll", onScroll);
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (loadOlderTimer.current) clearTimeout(loadOlderTimer.current);
      loadOlderTimer.current = null;
    };
  }, [chat.id, chat.messages.length, hasMore, olderLoading, onLoadOlder]);

  useEffect(() => {
    if (!jumpToId) return;
    const el = scrollRef.current?.querySelector(`[data-mid="${CSS.escape(jumpToId)}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [jumpToId]);

  useEffect(() => {
    if (!query) return;
    const el = scrollRef.current?.querySelector("mark");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [query]);

  const items = useMemo(() => {
    const msgs = chat.messages;
    const nodes: ReactNode[] = [];
    let lastDay = "";

    msgs.forEach((m, i) => {
      const day = formatDay(m.ts);
      if (day !== lastDay) {
        nodes.push(
          <div key={`d-${i}`} className="day-divider">
            {day}
          </div>
        );
        lastDay = day;
      }

      const next = msgs[i + 1];
      nodes.push(
        <div key={m.id} data-mid={m.id}>
          <MessageItem
            message={m}
            chatName={chat.name}
            myId={myId}
            own={m.authorId === myId}
            showName={!isGroupEdge(msgs[i - 1], m) ? false : m.authorId !== myId}
            showTime={isGroupEdge(next, m)}
            read={m.authorId === myId && m.ts <= readUpTo}
            query={query}
            onReact={onReact}
            onReply={onReply}
            onDelete={onDelete}
            onEdit={onEdit}
          />
        </div>
      );
    });

    if (nodes.length === 0) {
      nodes.push(
        <div key="empty" className="chat-empty-msgs">
          Здесь пока пусто — напишите первым!
        </div>
      );
    }
    return nodes;
  }, [chat.messages, chat.name, readUpTo, query, myId, onReact, onReply, onDelete]);

  return (
    <div className="messages" ref={scrollRef}>
      <div className="msg-history-head">
        {olderLoading ? (
          <span className="msg-history-note">Загружаем старые сообщения…</span>
        ) : hasMore ? (
          <button className="msg-history-btn" onClick={() => { olderScroll.current = scrollRef.current?.scrollHeight ?? null; onLoadOlder(); }}>
            Загрузить раньше
          </button>
        ) : null}
      </div>
      {items}
      {isTyping && <TypingBubble />}
    </div>
  );
});