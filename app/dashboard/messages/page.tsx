// app/dashboard/message/page.tsx
"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { RealTimeMessaging, type DecryptedMessage } from "@/lib/messaging";
import Link from "next/link";

interface Conversation {
  other_user: {
    id: string;
    email: string;
    profile?: any;
  };
  last_message: DecryptedMessage | any; // last raw row fallback
  unread_count: number;
}

export default function MessagesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  // keep a single active subscription (conversation or global)
  const realtimeRef = useRef<{ unsubscribe: () => void } | null>(null);

  // -------- Auth gate & bootstrap ----------
  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/auth/sign-in");
      return;
    }

    // Load conversations on mount
    void loadConversations();

    // Subscribe to new conversations globally
    const sub = RealTimeMessaging.subscribeToNewConversations(user.id, () => {
      // When a new message in any conversation arrives, refresh list
      void loadConversations();
    });
    realtimeRef.current = sub;

    // Cleanup on unmount
    return () => {
      try {
        realtimeRef.current?.unsubscribe?.();
      } catch {}
      realtimeRef.current = null;
      RealTimeMessaging.clearKeyCache();
    };
  }, [loading, user, router]);

  // -------- Data loaders ----------
  const loadConversations = async () => {
    if (!user?.id) return;
    setIsLoading(true);

    try {
      const { data: messagesData, error } = await supabase
        .from("messages")
        .select(
          `
          *,
          sender:sender_id(id, email),
          recipient:recipient_id(id, email)
        `,
        )
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching messages:", error);
        setConversations([]);
        return;
      }

      if (messagesData && Array.isArray(messagesData)) {
        const conversationMap = new Map<string, Conversation>();

        for (const m of messagesData) {
          const isSender = m.sender_id === user.id;
          const otherUserId = isSender ? m.recipient_id : m.sender_id;
          const otherUser = isSender ? m.recipient : m.sender;

          if (!otherUserId || !otherUser) continue;

          if (!conversationMap.has(otherUserId)) {
            conversationMap.set(otherUserId, {
              other_user: {
                id: otherUser.id,
                email: otherUser.email,
                profile: (otherUser as any)?.profile ?? undefined,
              },
              last_message: m,
              unread_count: 0,
            });
          }

          // update last message if this one is newer (we're ordered desc but keep safe)
          const existing = conversationMap.get(otherUserId)!;
          const existingTime = new Date(
            existing.last_message?.created_at ?? 0,
          ).getTime();
          const thisTime = new Date(m.created_at ?? 0).getTime();
          if (thisTime > existingTime) {
            existing.last_message = m;
          }

          // unread counts
          if (m.recipient_id === user.id && !m.read_at) {
            existing.unread_count += 1;
          }
        }

        setConversations(Array.from(conversationMap.values()));
      } else {
        setConversations([]);
      }
    } catch (err) {
      console.error("Error loading conversations:", err);
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (otherUserId: string) => {
    if (!user?.id || !otherUserId) return;

    const ac = new AbortController();
    try {
      // swap subscription to this conversation
      try {
        realtimeRef.current?.unsubscribe?.();
      } catch {}
      realtimeRef.current = null;

      const res = await fetch(`/api/messages/conversation/${otherUserId}`, {
        signal: ac.signal,
      });
      if (!res.ok) throw new Error("Failed to load messages");

      const payload = await res.json().catch(() => ({}));
      const decrypted: DecryptedMessage[] = Array.isArray(payload?.messages)
        ? payload.messages
        : [];

      setMessages(decrypted);

      // refresh conversation unread state
      void loadConversations();

      // realtime for this specific conversation
      const sub = RealTimeMessaging.subscribeToConversation(
        user.id,
        otherUserId,
        (newMsg) => {
          setMessages((prev) => [...prev, newMsg]);
          void loadConversations();
        },
      );
      realtimeRef.current = sub;
    } catch (err) {
      if ((err as any)?.name !== "AbortError") {
        console.error("Error loading messages:", err);
      }
    }
    // no finally for abort in this context; caller handles selection UI
  };

  // -------- Actions ----------
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || isSending) return;

    setIsSending(true);
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: selectedConversation,
          content: newMessage.trim(),
          messageType: "text",
        }),
      });

      if (!res.ok) throw new Error("Failed to send message");

      const { message } = await res.json();
      if (message) {
        setMessages((prev) => [...prev, message]);
      }
      setNewMessage("");

      void loadConversations();
    } catch (err) {
      console.error("Error sending message:", err);
      alert("Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  // -------- Utils ----------
  const formatMessageTime = (timestamp?: string) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      return date.toLocaleDateString();
    }
  };

  // -------- Render ----------
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

  if (!user) {
    return null;
  }

  const activeName = useMemo(() => {
    const c = conversations.find(
      (x) => x.other_user.id === selectedConversation,
    );
    if (!c) return "";
    return (
      c.other_user.profile?.display_name ||
      c.other_user.profile?.storefront_name ||
      (c.other_user.email ? c.other_user.email.split("@")[0] : "")
    );
  }, [conversations, selectedConversation]);

  return (
    <div className="h-[calc(100vh-200px)] flex glass-card overflow-hidden">
      {/* Conversations List */}
      <div className="w-full md:w-1/3 border-r border-accent-gold/20 flex flex-col">
        <div className="p-4 border-b border-accent-gold/20">
          <h2 className="font-serif text-xl font-bold text-accent-gold">
            Messages
          </h2>
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
              const isActive =
                selectedConversation === conversation.other_user.id;
              const name =
                conversation.other_user.profile?.display_name ||
                conversation.other_user.profile?.storefront_name ||
                (conversation.other_user.email
                  ? conversation.other_user.email.split("@")[0]
                  : "User");

              return (
                <button
                  key={conversation.other_user.id}
                  type="button"
                  onClick={() => {
                    setSelectedConversation(conversation.other_user.id);
                    void loadMessages(conversation.other_user.id);
                  }}
                  className={`w-full text-left p-4 border-b border-accent-gold/10 cursor-pointer hover:bg-accent-gold/5 transition-colors ${
                    isActive ? "bg-accent-gold/10" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{name}</h3>
                        {conversation.unread_count > 0 && (
                          <span className="bg-accent-gold text-primary-black text-xs px-2 py-1 rounded-full">
                            {conversation.unread_count}
                          </span>
                        )}
                      </div>
                      <p className="text-sm opacity-70 truncate">
                        {conversation.last_message?.content ?? ""}
                      </p>
                      <p className="text-xs opacity-50">
                        {formatMessageTime(
                          conversation.last_message?.created_at,
                        )}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="hidden md:flex flex-1 flex-col">
        {selectedConversation ? (
          <>
            {/* Messages Header */}
            <div className="p-4 border-b border-accent-gold/20">
              <h3 className="font-semibold">{activeName}</h3>
            </div>

            {/* Messages List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => {
                const fromMe = message.sender_id === user.id;
                return (
                  <div
                    key={message.id}
                    className={`flex ${fromMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        fromMe
                          ? "bg-accent-gold text-primary-black"
                          : "bg-charcoal/20 border border-accent-gold/20"
                      }`}
                    >
                      <p className="text-sm break-words">{message.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {formatMessageTime(message.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-accent-gold/20">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 rounded-lg bg-charcoal/20 border border-accent-gold/30 focus:border-accent-gold focus:outline-none"
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || isSending}
                  className="luxury-button px-4 py-2 disabled:opacity-50"
                >
                  {isSending ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center opacity-60">
              <svg
                className="w-16 h-16 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <p>Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* Mobile: if you want messages pane on small screens, you can swap layout.
          For now, we keep list full-width on mobile and messages on md+ to avoid cramped UI. */}
    </div>
  );
}
