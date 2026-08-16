export interface ReactionMap {
  [emoji: string]: string[];
}

export interface ReplyRef {
  id: string;
  authorId: string;
  authorName?: string;
  text: string;
}

export interface Message {
  id: string;
  chatId: string;
  authorId: string;
  authorName?: string;
  text: string;
  ts: number;
  replyTo?: ReplyRef | null;
  reactions?: ReactionMap;
  edited?: boolean;
  deleted?: boolean;
}

export interface Chat {
  id: string;
  name: string;
  gradient: string;
  members: string[];
  messages: Message[];
}

export interface ChatSummary {
  id: string;
  name: string;
  gradient: string;
  memberCount: number;
  online: boolean;
  unread: number;
  lastMessage: Message | null;
}

export interface User {
  id: string;
  name: string;
  gradient: string;
  online: boolean;
}

export const REACTION_EMOJIS = ["👍", "❤️", "😂", "🔥", "😍", "🎉", "👀", "🙏"] as const;