// components/product/ChatSellerButton.tsx
"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";

type Props = {
  sellerId: string;
  productId: string;
  productTitle: string;
};

export default function ChatSellerButton({ sellerId, productId, productTitle }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/chat/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId, productId }),
      });

      if (!res.ok) throw new Error("Failed to start chat");

      const data = await res.json();
      if (data.threadId) {
        router.push(`/messages?conversation=${encodeURIComponent(data.threadId)}`);
      }
    } catch (error) {
      console.error("Failed to start chat:", error);
      alert("Failed to start chat. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium transition hover:bg-white/5 disabled:opacity-50"
    >
      <MessageCircle className="h-4 w-4" />
      {isLoading ? "Starting chat..." : "Chat Seller"}
    </button>
  );
}
