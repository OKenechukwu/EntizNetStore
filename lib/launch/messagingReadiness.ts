import { describeMessageKeyBoundary } from "@/lib/messaging/messageCrypto";
import { describeMessageTranslationReadiness } from "@/lib/messaging/messageTranslation";

export type OptionalFeatureLaunchStatus = "configured" | "blocked";

export function storeChatLaunchStatus(): OptionalFeatureLaunchStatus {
  const dedicatedKey = process.env.MESSAGE_KEY_ENCRYPTION_KEY?.trim();
  if (!dedicatedKey) return "blocked";
  try {
    describeMessageKeyBoundary();
    return "configured";
  } catch {
    return "blocked";
  }
}

export function messageTranslationLaunchStatus(): OptionalFeatureLaunchStatus {
  return describeMessageTranslationReadiness().status;
}
