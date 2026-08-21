import fs from "node:fs";
import path from "node:path";

const targets = [
  {
    file: "components/messaging/MessageCenter.tsx",
    setupStart: "  // Detect user's browser language as source language",
    setupEnd: "  useEffect(",
  },
  {
    file: "components/messaging/EnhancedMessageCenter.tsx",
    setupStart: "  // ✅ Sender/source language",
    setupEnd: "  const categories:",
  },
];

function removeRange(content, startMarker, endMarker, file) {
  const start = content.indexOf(startMarker);
  if (start === -1) return content;
  const end = content.indexOf(endMarker, start);
  if (end === -1) throw new Error(`Could not find end marker in ${file}: ${endMarker}`);
  return content.slice(0, start) + content.slice(end);
}

for (const target of targets) {
  const absolute = path.join(process.cwd(), target.file);
  let content = fs.readFileSync(absolute, "utf8");
  const original = content;

  content = content.replace(
    /^.*import\s*\{\s*translate\s*\}\s*from\s*["']@\/lib\/i18n\/translate["'];?.*\n/gm,
    "",
  );

  content = removeRange(content, target.setupStart, target.setupEnd, target.file);

  const translationStartCandidates = [
    "      const targetLang = getRecipientLang(activeConversation);",
    "      const targetLang = getRecipientLang(activeConversation)",
  ];

  for (const marker of translationStartCandidates) {
    const start = content.indexOf(marker);
    if (start !== -1) {
      const end = content.indexOf("      const recipientId", start);
      if (end === -1) throw new Error(`Could not locate recipient block in ${target.file}`);
      content = content.slice(0, start) + "      const messageText = content.trim();\n\n" + content.slice(end);
      break;
    }
  }

  content = content.replace(/text:\s*translatedText/g, "text: messageText");
  content = content.replace(/\/\/ ✅ Updated sendMessage with DeepL translation\s*\n/g, "// Send the original user-authored message.\n");
  content = content.replace(/\/\/ ✅ DeepL Pro translation before saving\s*\n/g, "// Send the original user-authored message.\n");

  if (content.includes("@/lib/i18n/translate") || content.includes("getRecipientLang(") || content.includes("translatedText")) {
    throw new Error(`Legacy dynamic translation code remains in ${target.file}`);
  }

  if (content !== original) {
    fs.writeFileSync(absolute, content);
    console.log(`Removed legacy dynamic translation from ${target.file}`);
  } else {
    console.log(`No dynamic translation changes needed in ${target.file}`);
  }
}
