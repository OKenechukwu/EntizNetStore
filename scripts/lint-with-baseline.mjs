import fs from "node:fs";
import path from "node:path";
import { ESLint } from "eslint";

const root = process.cwd();
const baselinePath = path.join(root, "eslint-baseline.json");
const writeBaseline = process.argv.includes("--write-baseline");

// These rules are never grandfathered. They represent invalid Hook usage or a
// configuration/parser failure where accepting historical debt would be unsafe.
const zeroToleranceRules = new Set([
  "react-hooks/rules-of-hooks",
  "react-hooks/set-state-in-render",
]);

function normalizePath(filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

function findingKey(filePath, message) {
  const ruleId = message.ruleId ?? "<parser-or-config>";
  const messageId = message.messageId ?? "<message>";
  return `${normalizePath(filePath)}::${ruleId}::${messageId}`;
}

function collect(results) {
  const entries = new Map();
  let total = 0;
  let errors = 0;
  let warnings = 0;

  for (const result of results) {
    for (const message of result.messages) {
      if (message.severity <= 0) continue;
      const key = findingKey(result.filePath, message);
      entries.set(key, (entries.get(key) ?? 0) + 1);
      total += 1;
      if (message.severity === 2) errors += 1;
      if (message.severity === 1) warnings += 1;
    }
  }

  return { entries, total, errors, warnings };
}

function serializeBaseline(summary) {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    total: summary.total,
    errors: summary.errors,
    warnings: summary.warnings,
    entries: Object.fromEntries([...summary.entries.entries()].sort(([a], [b]) => a.localeCompare(b))),
  };
}

const eslint = new ESLint();
const results = await eslint.lintFiles(["."]);
const current = collect(results);

if (writeBaseline) {
  fs.writeFileSync(baselinePath, `${JSON.stringify(serializeBaseline(current), null, 2)}\n`);
  console.log(
    `Wrote ESLint baseline: ${current.total} findings (${current.errors} errors, ${current.warnings} warnings).`,
  );
  process.exit(0);
}

if (!fs.existsSync(baselinePath)) {
  console.error("ESLint baseline is missing. Generate it intentionally with npm run lint -- --write-baseline.");
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
if (baseline.version !== 1 || typeof baseline.entries !== "object" || baseline.entries === null) {
  console.error("ESLint baseline format is invalid.");
  process.exit(1);
}

const regressions = [];
for (const result of results) {
  for (const message of result.messages) {
    if (message.severity <= 0) continue;

    const ruleId = message.ruleId ?? "<parser-or-config>";
    const key = findingKey(result.filePath, message);
    const allowed = Number(baseline.entries[key] ?? 0);
    const currentCount = current.entries.get(key) ?? 0;

    if (
      ruleId === "<parser-or-config>"
      || zeroToleranceRules.has(ruleId)
      || currentCount > allowed
    ) {
      regressions.push({
        file: normalizePath(result.filePath),
        line: message.line,
        column: message.column,
        ruleId,
        message: message.message,
        currentCount,
        allowed,
      });
    }
  }
}

const uniqueRegressions = [
  ...new Map(
    regressions.map((item) => [
      `${item.file}:${item.line}:${item.column}:${item.ruleId}:${item.message}`,
      item,
    ]),
  ).values(),
];

if (uniqueRegressions.length > 0) {
  console.error("ESLint non-regression gate FAILED:\n");
  for (const item of uniqueRegressions.slice(0, 100)) {
    console.error(
      `- ${item.file}:${item.line}:${item.column} ${item.ruleId}: ${item.message} (current category count ${item.currentCount}, baseline ${item.allowed})`,
    );
  }
  if (uniqueRegressions.length > 100) {
    console.error(`- ...and ${uniqueRegressions.length - 100} more regressions`);
  }
  process.exit(1);
}

const improvement = Number(baseline.total ?? current.total) - current.total;
console.log(
  `ESLint non-regression gate passed: ${current.total} known findings (${current.errors} errors, ${current.warnings} warnings); ${Math.max(improvement, 0)} finding(s) improved since the committed baseline.`,
);
