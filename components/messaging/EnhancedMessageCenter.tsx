"use client";

import { useState, useEffect } from "react";
import { useBrand } from "@/components/BrandProvider";
import { getSupabaseClient } from "@/lib/supabase/client";
import ConversationList from "./ConversationList";
import ChatWindow from "./ChatWindow";
import { translate } from "@/lib/i18n/translate"; // ✅ DeepL helper

interface MessageCenterProps {
  currentUserId: string;
  userType: "buyer" | "seller";
  initialConversationId?: string;
}

type MessageCategory = "inquiries" | "orders" | "promos";

interface CategoryConfig {
  id: MessageCategory;
  label: string;
  icon: string;
  conversationTypes: string[];
  description: string;
}

export default function EnhancedMessageCenter({
  currentUserId,
  userType,
  initialConversationId,
}: MessageCenterProps) {
  const { brand, theme } = useBrand();
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversation, setActiveConversation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] =
    useState<MessageCategory>("inquiries");
  const [notifications, setNotifications] = useState<
    Record<MessageCategory, number>
  >({
    inquiries: 0,
    orders: 0,
    promos: 0,
  });
  const supabase = getSupabaseClient();

  // ✅ Sender/source language (fallback to 'en')
  const sourceLang =
    (typeof navigator !== "undefined"
      ? navigator.language.split("-")[0]
      : "en") || "en";

  // ✅ Recipient/target language from conversation object (adjust when you add profile fields)
  const getRecipientLang = (conv: any) => {
    return conv?.partner_lang || conv?.otherUser?.lang || "en";
  };

  const categories: CategoryConfig[] = [
    {
      id: "inquiries",
      label: "Inquiries",
      icon: "💬",
      conversationTypes: ["general", "product_inquiry", "support"],
      description:
        userType === "seller"
          ? "Customer questions and general inquiries"
          : "Your questions and support requests",
    },
    {
      id: "orders",
      label: "Orders",
      icon: "📦",
      conversationTypes: ["order_chat", "order_inquiry", "delivery"],
      description:
        userType === "seller"
          ? "Order-related communications with customers"
          : "Your order updates and delivery notifications",
    },
    {
      id: "promos",
      label: "Promos",
      icon: "🎯",
      conversationTypes: ["promotional", "system", "announcement"],
      description:
        userType === "seller"
          ? "Promotional campaigns and announcements"
          : "Special offers and exclusive deals",
    },
  ];

  useEffect(() => {
    loadConversations();
    loadNotifications();

    // Realtime subscription
    const channel = supabase
      .channel("conversations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => {
          loadConversations();
          loadNotifications();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          if (activeConversation) {
            loadMessages(activeConversation.id);
          }
          loadNotifications();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const loadConversations = async () => {
    try {
      const activeConfig = categories.find((c) => c.id === activeCategory);
      if (!activeConfig) return;

      const { data, error } = await supabase
        .from("conversations")
        .select(
          `
          *,
          messages(
            id, content, created_at, sender_id,
            conversation_id, is_read
          )
        `,
        )
        .contains("participants", [currentUserId])
        .in("type", activeConfig.conversationTypes)
        .order("last_message_at", { ascending: false });

      if (error) throw error;

      const processedConversations =
        data?.map((conv) => {
          const latestMessage = conv.messages?.[conv.messages.length - 1];
          const unreadCount =
            conv.messages?.filter(
              (msg: any) => msg.sender_id !== currentUserId && !msg.is_read,
            ).length || 0;

          return {
            ...conv,
            latestMessage,
            unreadCount,
          };
        }) || [];

      setConversations(processedConversations);
      if (initialConversationId && !activeConversation) {
        const requested = processedConversations.find(
          (conversation) => conversation.id === initialConversationId,
        );
        if (requested) {
          setActiveConversation(requested);
          void loadMessages(requested.id);
        }
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadNotifications = async () => {
    try {
      const notificationCounts: Record<MessageCategory, number> = {
        inquiries: 0,
        orders: 0,
        promos: 0,
      };

      for (const category of categories) {
        const { data, error } = await supabase
          .from("conversations")
          .select(
            `
            id,
            messages(
              id, sender_id, is_read
            )
          `,
          )
          .contains("participants", [currentUserId])
          .in("type", category.conversationTypes);

        if (!error && data) {
          const unreadCount = data.reduce((total, conv) => {
            const unread =
              conv.messages?.filter(
                (msg: any) => msg.sender_id !== currentUserId && !msg.is_read,
              ).length || 0;
            return total + unread;
          }, 0);

          notificationCounts[category.id] = unreadCount;
        }
      }

      setNotifications(notificationCounts);
    } catch (error) {
      console.error("Error loading notifications:", error);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setActiveConversation((prev) => ({
        ...prev,
        messages: data || [],
      }));

      await supabase.rpc("mark_conversation_read", {
        target_conversation_id: conversationId,
      });

      // Refresh badges
      loadNotifications();
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  // ✅ DeepL Pro translation before saving
  const sendMessage = async (content: string, attachments: string[] = []) => {
    if (!activeConversation || !content.trim()) return;

    try {
      const targetLang = getRecipientLang(activeConversation);
      let translatedText = content.trim();

      if (targetLang && targetLang !== sourceLang) {
        try {
          translatedText = await translate(content.trim(), targetLang, {
            sourceLang,
          });
        } catch (err) {
          console.error("Translation failed, sending original:", err);
        }
      }

      const recipientId = activeConversation.participants?.find(
        (id: string) => id !== currentUserId,
      );
      if (!recipientId) throw new Error("Conversation recipient is missing");

      const response = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: translatedText,
          threadId: activeConversation.id,
          recipientId,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || "Failed to send message");
      }

      // refresh thread
      loadMessages(activeConversation.id);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const startConversation = async (
    otherUserId: string,
    subject: string,
    conversationType: string = "general",
  ) => {
    try {
      const { data, error } = await supabase
        .from("conversations")
        .insert({
          type: conversationType,
          participants: [currentUserId, otherUserId],
          subject: subject,
          metadata: conversationType.includes("order")
            ? { order_reference: `order_${Date.now()}` }
            : {},
        })
        .select()
        .single();

      if (error) throw error;

      await loadConversations();
      setActiveConversation(data);
    } catch (error) {
      console.error("Error starting conversation:", error);
    }
  };

  // Refresh list when switching category
  useEffect(() => {
    if (activeCategory) {
      setLoading(true);
      setActiveConversation(null);
      loadConversations();
    }
  }, [activeCategory]);

  const activeCategoryConfig = categories.find((c) => c.id === activeCategory);

  return (
    <div
      className="min-h-screen flex"
      style={{ backgroundColor: theme.colors.background }}
    >
      {/* Sidebar - Categories and Conversation List */}
      <div
        className="w-80 border-r flex flex-col"
        style={{
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.glass.border,
        }}
      >
        {/* Header */}
        <div
          className="p-4 border-b"
          style={{ borderColor: theme.colors.glass.border }}
        >
          <h1
            className="text-xl font-bold mb-2"
            style={{ color: theme.colors.text.primary }}
          >
            {brand === "primediscreet" ? "Elite Inbox" : "Inbox"}
          </h1>
          <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
            {userType === "seller"
              ? brand === "primediscreet"
                ? "Elite customer communications"
                : "Customer communications"
              : "Your messages and notifications"}
          </p>
        </div>

        {/* Category Tabs */}
        <div
          className="border-b"
          style={{ borderColor: theme.colors.glass.border }}
        >
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`w-full p-4 text-left border-b transition-all ${
                activeCategory === category.id
                  ? "border-l-4"
                  : "border-l-4 border-l-transparent hover:bg-opacity-50"
              }`}
              style={{
                backgroundColor:
                  activeCategory === category.id
                    ? `${theme.colors.accent}15`
                    : "transparent",
                borderBottomColor: theme.colors.glass.border,
                borderLeftColor:
                  activeCategory === category.id
                    ? theme.colors.accent
                    : "transparent",
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{category.icon}</span>
                  <span
                    className={`font-medium ${activeCategory === category.id ? "font-semibold" : ""}`}
                    style={{
                      color:
                        activeCategory === category.id
                          ? theme.colors.text.primary
                          : theme.colors.text.secondary,
                    }}
                  >
                    {category.label}
                  </span>
                </div>
                {notifications[category.id] > 0 && (
                  <span
                    className="text-xs px-2 py-1 rounded-full font-bold"
                    style={{
                      backgroundColor: theme.colors.accent,
                      color:
                        brand === "primediscreet"
                          ? theme.colors.background
                          : "white",
                    }}
                  >
                    {notifications[category.id]}
                  </span>
                )}
              </div>
              <p
                className="text-xs"
                style={{ color: theme.colors.text.secondary }}
              >
                {category.description}
              </p>
            </button>
          ))}
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {activeCategoryConfig && (
            <>
              <div
                className="p-3 border-b"
                style={{ borderColor: theme.colors.glass.border }}
              >
                <h3
                  className="text-sm font-medium"
                  style={{ color: theme.colors.text.primary }}
                >
                  {activeCategoryConfig.label}
                </h3>
                <p
                  className="text-xs"
                  style={{ color: theme.colors.text.secondary }}
                >
                  {conversations.length} conversation
                  {conversations.length !== 1 ? "s" : ""}
                </p>
              </div>
              <ConversationList
                conversations={conversations}
                activeConversation={activeConversation}
                onSelectConversation={(conv) => {
                  setActiveConversation(conv);
                  loadMessages(conv.id);
                }}
                loading={loading}
              />
            </>
          )}
        </div>

        {/* New Conversation Button */}
        <div
          className="p-4 border-t"
          style={{ borderColor: theme.colors.glass.border }}
        >
          <button
            onClick={() => {}}
            className="w-full px-4 py-2 rounded-lg font-medium transition-all"
            style={{
              backgroundColor: theme.colors.accent,
              color:
                brand === "primediscreet"
                  ? theme.colors.background
                  : theme.colors.text.primary,
            }}
          >
            {activeCategory === "inquiries" &&
              (brand === "primediscreet" ? "Elite Inquiry" : "New Inquiry")}
            {activeCategory === "orders" && "Order Support"}
            {activeCategory === "promos" && "Contact Sales"}
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeConversation ? (
          <ChatWindow
            conversation={activeConversation}
            currentUserId={currentUserId}
            userType={userType}
            onSendMessage={sendMessage}
          />
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div
                className="text-6xl mb-4"
                style={{ color: theme.colors.accent }}
              >
                {activeCategoryConfig?.icon || "💬"}
              </div>
              <h3
                className="text-xl font-semibold mb-2"
                style={{ color: theme.colors.text.primary }}
              >
                {activeCategoryConfig
                  ? `${activeCategoryConfig.label} Center`
                  : brand === "primediscreet"
                    ? "Elite Communication Center"
                    : "Select a conversation"}
              </h3>
              <p style={{ color: theme.colors.text.secondary }}>
                {activeCategoryConfig
                  ? activeCategoryConfig.description
                  : userType === "seller"
                    ? brand === "primediscreet"
                      ? "Manage elite customer communications"
                      : "Choose a conversation to view customer messages"
                    : "Select a conversation to start chatting"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
