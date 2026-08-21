import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceRoots = ["app", "components", "lib", "client", "server"];
const changed = [];

function walk(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [relativePath];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const next = path.join(relativePath, entry.name);
    return entry.isDirectory() ? walk(next) : [next];
  });
}

for (const relativePath of sourceRoots.flatMap(walk)) {
  if (!/\.[jt]sx?$/.test(relativePath)) continue;
  const absolute = path.join(root, relativePath);
  let content = fs.readFileSync(absolute, "utf8");
  if (!content.includes("@supabase/auth-helpers-nextjs")) continue;

  const original = content;

  content = content.replace(
    /^import\s*\{\s*createServerComponentClient\s*\}\s*from\s*["']@supabase\/auth-helpers-nextjs["'];?\s*\n/gm,
    "",
  );

  content = content.replace(
    /createServerComponentClient\s*\(\s*\{\s*cookies\s*\}\s*\)/g,
    "await createServerSupabase()",
  );

  if (!content.includes("createServerSupabase")) {
    throw new Error(`Could not migrate createServerComponentClient usage in ${relativePath}`);
  }

  if (!content.includes('from "@/lib/supabase/server"') && !content.includes("from '@/lib/supabase/server'")) {
    content = `import { createServerSupabase } from "@/lib/supabase/server";\n${content}`;
  }

  const cookiesImport = /^import\s*\{\s*cookies\s*\}\s*from\s*["']next\/headers["'];?\s*\n/m;
  const withoutCookiesImport = content.replace(cookiesImport, "");
  if (!/\bcookies\b/.test(withoutCookiesImport)) {
    content = withoutCookiesImport;
  }

  if (content.includes("@supabase/auth-helpers-nextjs")) {
    throw new Error(`Legacy auth-helper import remains in ${relativePath}`);
  }

  if (content !== original) {
    fs.writeFileSync(absolute, content);
    changed.push(relativePath);
  }
}

console.log(`Migrated ${changed.length} files away from @supabase/auth-helpers-nextjs.`);
for (const file of changed) console.log(`- ${file}`);
