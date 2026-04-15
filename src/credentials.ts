/**
 * Credential resolution for @doubleword/vercel-ai.
 *
 * Resolves the Doubleword inference API key by walking:
 *
 * 1. Explicit `apiKey` option passed to `createDoubleword()`.
 * 2. `DOUBLEWORD_API_KEY` environment variable.
 * 3. `~/.dw/config.toml` for `active_account`, then
 *    `~/.dw/credentials.toml` for `accounts.<name>.inference_key`.
 * 4. `undefined` -- the upstream provider will surface an error on first call.
 *
 * All file-system and TOML parse errors are swallowed so that users who never
 * opted into credential files are not confused by unrelated errors.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parse as parseTOML } from "smol-toml";

const DW_HOME = join(homedir(), ".dw");
const CONFIG_FILE = join(DW_HOME, "config.toml");
const CREDENTIALS_FILE = join(DW_HOME, "credentials.toml");

function readActiveAccount(): string | undefined {
  try {
    const raw = readFileSync(CONFIG_FILE, "utf-8");
    const data = parseTOML(raw);
    const active = data["active_account"];
    if (typeof active === "string" && active.length > 0) {
      return active;
    }
  } catch {
    // file missing, unreadable, or malformed -- fall through
  }
  return undefined;
}

function readInferenceKey(account: string): string | undefined {
  try {
    const raw = readFileSync(CREDENTIALS_FILE, "utf-8");
    const data = parseTOML(raw);
    const accounts = data["accounts"];
    if (typeof accounts !== "object" || accounts === null) {
      return undefined;
    }
    const entry = (accounts as Record<string, unknown>)[account];
    if (typeof entry !== "object" || entry === null) {
      return undefined;
    }
    const key = (entry as Record<string, unknown>)["inference_key"];
    if (typeof key === "string" && key.length > 0) {
      return key;
    }
  } catch {
    // fall through
  }
  return undefined;
}

/**
 * Resolve a Doubleword API key from the environment, then credential files.
 * Returns `undefined` if no key can be found.
 */
export function resolveApiKey(): string | undefined {
  const envKey = process.env["DOUBLEWORD_API_KEY"];
  if (envKey) {
    return envKey;
  }

  const account = readActiveAccount();
  if (!account) {
    return undefined;
  }

  return readInferenceKey(account);
}

/**
 * Resolve the base URL for the Doubleword API.
 */
export function resolveBaseURL(): string {
  return (
    process.env["DOUBLEWORD_API_BASE"] ?? "https://api.doubleword.ai/v1"
  );
}
