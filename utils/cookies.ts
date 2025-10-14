"use client";
export function cookiesGet(name: string) {
  // client-safe cookie read
  const match = document?.cookie?.match(
    new RegExp("(^| )" + name + "=([^;]+)"),
  );
  return match?.[2] || "";
}
