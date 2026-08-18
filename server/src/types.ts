export interface User {
  id: string;
  name: string;
  gradient: string;
  avatar?: string;
  banner?: string;
  online: boolean;
}

export interface ReactionMap {
  [emoji: string]: string[];
}

export interface ReplyRef {
  id: string;
  authorId: string;
  authorName?: string;
  text: string;
}

export interface Attachment {
  url: string;
  kind: "image" | "file";
  name?: string;
  size?: number;
  w?: number;
  h?: number;
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
  attach?: Attachment | null;
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
  members: string[];
  memberCount: number;
  online: boolean;
  unread: number;
  lastMessage: Message | null;
}

export interface NewMessageInput {
  chatId: string;
  text: string;
  replyTo?: ReplyRef | null;
  attach?: Attachment | null;
}

export interface NewChatInput {
  name: string;
  memberIds: string[];
}