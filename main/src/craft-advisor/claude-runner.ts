import { spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// Слой 5 (main-сторона): запуск локального `claude -p` через подписку
// пользователя (НЕ API-ключ). Изоляция от агентной обвязки:
//  - claude.exe спавнится напрямую без shell → многострочный --system-prompt
//    передаётся как есть, нет shell-инъекции и проблем с квотингом;
//  - --system-prompt заменяет агентный системный промпт (нет «статусов доски»);
//  - cwd = временная папка → не подхватывается проектный CLAUDE.md;
//  - модель санируется.

const MODEL_SAFE = /^[a-zA-Z0-9._-]+$/;
const DEFAULT_MODEL = "sonnet";
const TIMEOUT_MS = 180_000;

export interface ClaudeRunResult {
  success: boolean;
  result?: string;
  error?: string;
}

interface ClaudeCliJson {
  is_error?: boolean;
  result?: string;
}

function resolveClaudeBin(): { cmd: string; useShell: boolean } {
  const override = process.env.CRAFT_ADVISOR_CLAUDE_BIN;
  if (override && fs.existsSync(override)) return { cmd: override, useShell: false };

  if (process.platform === "win32" && process.env.APPDATA) {
    const exe = path.join(
      process.env.APPDATA,
      "npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe",
    );
    if (fs.existsSync(exe)) return { cmd: exe, useShell: false };
  }
  // fallback: полагаемся на PATH (shell нужен на Windows для .cmd-шима)
  return { cmd: "claude", useShell: process.platform === "win32" };
}

export async function runClaudePrompt(
  system: string,
  user: string,
  model: string,
): Promise<ClaudeRunResult> {
  const safeModel = MODEL_SAFE.test(model) ? model : DEFAULT_MODEL;
  const { cmd, useShell } = resolveClaudeBin();

  // В no-shell режиме system идёт отдельным аргументом (безопасно для многострочного).
  // В shell-fallback аргумент с пробелами/переносами ненадёжен — кладём всё в stdin.
  const args = ["-p", "--output-format", "json", "--model", safeModel];
  let stdin = user;
  if (!useShell) {
    args.push("--system-prompt", system);
  } else {
    stdin = `${system}\n\n---\n\n${user}`;
  }

  return await new Promise<ClaudeRunResult>((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, {
        shell: useShell,
        windowsHide: true,
        cwd: os.tmpdir(),
      });
    } catch (e) {
      resolve({ success: false, error: `Не удалось запустить claude: ${(e as Error).message}` });
      return;
    }

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      resolve({ success: false, error: "claude CLI: таймаут." });
    }, TIMEOUT_MS);

    child.stdout.on("data", (d) => (stdout += d.toString("utf-8")));
    child.stderr.on("data", (d) => (stderr += d.toString("utf-8")));

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        success: false,
        error: `claude CLI недоступен (${err.message}). Установлен ли Claude Code и выполнен ли вход в подписку?`,
      });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        resolve({
          success: false,
          error: `claude CLI завершился с кодом ${code}: ${stderr.slice(0, 500)}`,
        });
        return;
      }
      try {
        const json = JSON.parse(stdout) as ClaudeCliJson;
        if (json.is_error || !json.result) {
          resolve({ success: false, error: `claude CLI: ${json.result ?? "пустой ответ"}` });
        } else {
          resolve({ success: true, result: json.result });
        }
      } catch {
        const text = stdout.trim();
        if (text) resolve({ success: true, result: text });
        else resolve({ success: false, error: `claude CLI: не разобран вывод. ${stderr.slice(0, 300)}` });
      }
    });

    child.stdin.write(stdin);
    child.stdin.end();
  });
}
