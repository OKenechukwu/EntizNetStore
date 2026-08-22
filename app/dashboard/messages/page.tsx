"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

type MessageAttachment = {
  id: string;
  message_id: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string | null;
};

type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  attachments?: MessageAttachment[];
};

type Conversation = {
  other_user: {
    id: string;
    email: string;
  };
  last_message: {
    id: string;
    content: string;
    created_at: string;
  };
  unread_count: number;
};

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

export default function MessagesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/auth/sign-in");
      return;
    }
    void loadConversations();
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    const interval = window.setInterval(() => {
      void loadConversations(false);
      if (selectedConversation) void loadMessages(selectedConversation, false);
    }, 12000);
    return () => window.clearInterval(interval);
  }, [user, selectedConversation]);

  async function loadConversations(showLoading = true) {
    if (!user) return;
    if (showLoading) setIsLoading(true);
    try {
      const response = await fetch("/api/messages/conversations", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to load conversations");
      setConversations(Array.isArray(result.conversations) ? result.conversations : []);
    } catch (caught) {
      console.error("Conversation loading failed:", caught);
      setError(caught instanceof Error ? caught.message : "Unable to load conversations");
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }

  async function loadMessages(otherUserId: string, showLoading = true) {
    if (!user) return;
    if (showLoading) setConversationLoading(true);
    try {
      const response = await fetch(`/api/messages/conversation/${otherUserId}`, { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Unable to load messages");
      setMessages(Array.isArray(result.messages) ? result.messages : []);
      void loadConversations(false);
    } catch (caught) {
      console.error("Message loading failed:", caught);
      setError(caught instanceof Error ? caught.message : "Unable to load messages");
    } finally {
      if (showLoading) setConversationLoading(false);
    }
  }

  function selectFile(file: File | undefined) {
    setError(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (
      !ATTACHMENT_TYPES.has(file.type.toLowerCase()) ||
      file.size <= 0 ||
      file.size > MAX_ATTACHMENT_BYTES
    ) {
      setSelectedFile(null);
      if (fileInput.current) fileInput.current.value = "";
      setError("Attachments must be PDF, JPEG, PNG, or WebP and no larger than 15MB.");
      return;
    }
    setSelectedFile(file);
  }

  async function sendMessage() {
    if (!selectedConversation || isSending) return;
    const text = newMessage.trim();
    if (!text && !selectedFile) return;

    setIsSending(true);
    setError(null);
    try {
      const response = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: selectedConversation,
          content: text || "Shared an attachment",
          messageType: "text",
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.message?.id) {
        throw new Error(result.error || "Unable to send message");
      }

      if (selectedFile) {
        const form = new FormData();
        form.append("messageId", result.message.id);
        form.append("file", selectedFile);
        const attachmentResponse = await fetch("/api/messages/attachments/upload", {
          method: "POST",
          body: form,
        });
        const attachmentResult = await attachmentResponse.json().catch(() => ({}));
        if (!attachmentResponse.ok) {
          throw new Error(
            attachmentResult.error ||
              "The message was sent, but its attachment could not be uploaded.",
          );
        }
      }

      setNewMessage("");
      setSelectedFile(null);
      if (fileInput.current) fileInput.current.value = "";
      await Promise.all([
        loadMessages(selectedConversation, false),
        loadConversations(false),
      ]);
    } catch (caught) {
      console.error("Message sending failed:", caught);
      setError(caught instanceof Error ? caught.message : "Unable to send message");
      if (selectedConversation) void loadMessages(selectedConversation, false);
    } finally {
      setIsSending(false);
    }
  }

  async function openAttachment(attachment: MessageAttachment) {
    setError(null);
    const popup = window.open("about:blank", "_blank");
    try {
      const response = await fetch(`/api/messages/attachments/download?id=${attachment.id}`, {
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.url !== "string") {
        throw new Error(result.error || "Unable to open attachment");
      }
      if (popup) popup.location.href = result.url;
      else window.location.href = result.url;
    } catch (caught) {
      popup?.close();
      setError(caught instanceof Error ? caught.message : "Unable to open attachment");
    }
  }

  const activeConversation = useMemo(
    () => conversations.find((item) => item.other_user.id === selectedConversation),
    [conversations, selectedConversation],
  );

  const activeName = activeConversation
    ? activeConversation.other_user.email?.split("@")[0] || "Member"
    : "";

  if (loading || isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="opacity-80">Loading messages...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="space-y-3">
      {error && (
        <div role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="h-[calc(100vh-210px)] min-h-[520px] flex glass-card overflow-hidden">
        <aside
          className={`${selectedConversation ? "hidden md:flex" : "flex"} w-full md:w-1/3 border-r border-accent-gold/20 flex-col`}
        >
          <div className="p-4 border-b border-accent-gold/20 flex items-center justify-between gap-3">
            <h1 className="font-serif text-xl font-bold text-accent-gold">Messages</h1>
            <button
              type="button"
              onClick={() => void loadConversations()}
              className="text-xs opacity-70 hover:opacity-100"
            >
              Refresh
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-6 text-center">
                <p className="opacity-60 mb-4">No conversations yet</p>
                <Link href="/store" className="luxury-button-outline px-4 py-2">
                  Browse Products
                </Link>
              </div>
            ) : (
              conversations.map((conversation) => {
                const isActive = selectedConversation === conversation.other_user.id;
                const name = conversation.other_user.email?.split("@")[0] || "Member";
                return (
                  <button
                    key={conversation.other_user.id}
                    type="button"
                    onClick={() => {
                      setSelectedConversation(conversation.other_user.id);
                      void loadMessages(conversation.other_user.id);
                    }}
                    className={`w-full text-left p-4 border-b border-accent-gold/10 hover:bg-accent-gold/5 transition-colors ${
                      isActive ? "bg-accent-gold/10" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h2 className="font-medium truncate">{name}</h2>
                          {conversation.unread_count > 0 && (
                            <span className="bg-accent-gold text-primary-black text-xs px-2 py-0.5 rounded-full">
                              {conversation.unread_count}
                            </span>
                          )}
                        </div>
                        <p className="text-sm opacity-70 truncate mt-1">
                          {conversation.last_message?.content || "Message"}
                        </p>
                        <p className="text-xs opacity-50 mt-1">
                          {formatMessageTime(conversation.last_message?.created_at)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className={`${selectedConversation ? "flex" : "hidden md:flex"} flex-1 flex-col min-w-0`}>
          {selectedConversation ? (
            <>
              <div className="p-4 border-b border-accent-gold/20 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedConversation(null);
                    setMessages([]);
                  }}
                  className="md:hidden luxury-button-outline px-3 py-1.5"
                >
                  Back
                </button>
                <div className="min-w-0">
                  <h2 className="font-semibold truncate">{activeName}</h2>
                  <p className="text-xs opacity-55">Private conversation</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {conversationLoading ? (
                  <div className="h-full flex items-center justify-center opacity-60">Loading conversation…</div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center opacity-60">
                    Start the conversation below.
                  </div>
                ) : (
                  messages.map((message) => {
                    const fromMe = message.sender_id === user.id;
                    return (
                      <div
                        key={message.id}
                        className={`flex ${fromMe ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-md px-4 py-3 rounded-xl ${
                            fromMe
                              ? "bg-accent-gold text-primary-black"
                              : "bg-charcoal/20 border border-accent-gold/20"
                          }`}
                        >
                          <p className="text-sm break-words whitespace-pre-wrap">{message.content}</p>

                          {(message.attachments ?? []).length > 0 && (
                            <div className="mt-3 space-y-2">
                              {(message.attachments ?? []).map((attachment) => (
                                <button
                                  key={attachment.id}
                                  type="button"
                                  onClick={() => void openAttachment(attachment)}
                                  className={`block w-full rounded-lg border px-3 py-2 text-left text-xs ${
                                    fromMe
                                      ? "border-black/20 bg-black/5 hover:bg-black/10"
                                      : "border-accent-gold/20 bg-black/10 hover:bg-black/20"
                                  }`}
                                >
                                  <span className="block font-medium break-all">{attachment.file_name}</span>
                                  <span className="block mt-1 opacity-65">
                                    {attachment.mime_type || "Attachment"}
                                    {attachment.file_size ? ` · ${formatFileSize(attachment.file_size)}` : ""}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}

                          <p className="text-xs opacity-65 mt-2">
                            {formatMessageTime(message.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-4 border-t border-accent-gold/20 space-y-3">
                {selectedFile && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-accent-gold/20 bg-accent-gold/5 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{selectedFile.name}</p>
                      <p className="text-xs opacity-60">{formatFileSize(selectedFile.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInput.current) fileInput.current.value = "";
                      }}
                      className="text-xs underline"
                    >
                      Remove
                    </button>
                  </div>
                )}

                <div className="flex gap-2 items-end">
                  <button
                    type="button"
                    disabled={isSending}
                    onClick={() => fileInput.current?.click()}
                    className="luxury-button-outline px-3 py-2 disabled:opacity-50"
                    aria-label="Attach a file"
                    title="Attach PDF or image"
                  >
                    Attach
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) => selectFile(event.target.files?.[0])}
                  />
                  <textarea
                    rows={2}
                    value={newMessage}
                    onChange={(event) => setNewMessage(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void sendMessage();
                      }
                    }}
                    maxLength={10000}
                    placeholder="Type a message…"
                    className="flex-1 resize-none px-4 py-2 rounded-lg bg-charcoal/20 border border-accent-gold/30 focus:border-accent-gold focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void sendMessage()}
                    disabled={(!newMessage.trim() && !selectedFile) || isSending}
                    className="luxury-button px-4 py-2 disabled:opacity-50"
                  >
                    {isSending ? "Sending…" : "Send"}
                  </button>
                </div>
                <p className="text-xs opacity-50">
                  Attachments are private. PDF/JPEG/PNG/WebP only, up to 15MB. Press Shift+Enter for a new line.
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center opacity-60 px-6">
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm mt-2">Messages and private attachments will appear here.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function formatMessageTime(timestamp?: string) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  if (diffInHours < 24 && date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: date.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
