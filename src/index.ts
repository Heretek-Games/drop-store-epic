import type {
  ClientPlugin,
  ClientPluginContext,
  ScannedGame,
  StoreScanner,
} from "@droposs/plugin-sdk";

export interface StoreCandidate {
  externalId: string;
  title: string;
  installPath: string;
  executablePath?: string;
}

/**
 * Storage keys the desktop host (or a host-side collector) is expected to
 * populate. Reading Epic's manifest directory from disk is a host
 * responsibility: this plugin has no arbitrary filesystem access and never
 * probes the OS.
 *
 * - `manifests`: raw `.item` manifest contents (JSON strings or parsed objects)
 * - `library`: optional pre-normalized candidate array (legacy fallback)
 */
export const EPIC_STORAGE_KEYS = {
  manifests: "manifests",
  library: "library",
} as const;

export interface EpicManifestRecord {
  AppName?: unknown;
  CatalogItemId?: unknown;
  MainGameAppName?: unknown;
  DisplayName?: unknown;
  name?: unknown;
  title?: unknown;
  InstallLocation?: unknown;
  installPath?: unknown;
  LaunchExecutable?: unknown;
  executablePath?: unknown;
  bIsIncompleteInstall?: unknown;
  [key: string]: unknown;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

function isAbsolutePath(value: string): boolean {
  return (
    value.startsWith("/") ||
    value.startsWith("\\\\") ||
    /^[a-zA-Z]:[\\/]/.test(value)
  );
}

function separatorFor(parts: string[]): string {
  return parts.some((part) => part.includes("\\")) ? "\\" : "/";
}

/** Join path segments using the separator style found in the inputs. */
export function joinPath(...parts: string[]): string {
  const filtered = parts.filter((part) => part.length > 0);
  if (filtered.length === 0) return "";
  const separator = separatorFor(filtered);
  return filtered
    .map((part, index) => {
      let segment = part;
      if (index > 0) segment = segment.replace(/^[\\/]+/, "");
      if (index < filtered.length - 1) segment = segment.replace(/[\\/]+$/, "");
      return segment;
    })
    .join(separator);
}

/**
 * Parse one Epic Games Launcher `.item` manifest (raw JSON text or an already
 * parsed object). Manifests explicitly flagged as incomplete installs are
 * skipped rather than reported as installed games. Returns `null` when the
 * manifest is malformed or carries no usable app id.
 */
export function parseEpicManifest(input: unknown): StoreCandidate | null {
  let record: unknown = input;
  if (typeof input === "string") {
    try {
      record = JSON.parse(input);
    } catch {
      return null;
    }
  }
  if (typeof record !== "object" || record === null || Array.isArray(record)) {
    return null;
  }
  const manifest = record as EpicManifestRecord;
  if (manifest.bIsIncompleteInstall === true) return null;
  const externalId = firstString(
    manifest.AppName,
    manifest.CatalogItemId,
    manifest.MainGameAppName,
    manifest.id,
  );
  if (!externalId) return null;
  const installPath =
    firstString(manifest.InstallLocation, manifest.installPath) ?? "";
  const title =
    firstString(manifest.DisplayName, manifest.name, manifest.title) ??
    "Unknown";
  const executable = firstString(
    manifest.LaunchExecutable,
    manifest.executablePath,
  );
  const executablePath = executable
    ? isAbsolutePath(executable) || installPath.length === 0
      ? executable
      : joinPath(installPath, executable)
    : undefined;
  return { externalId, title, installPath, executablePath };
}

/**
 * Parse a batch of manifests, skipping malformed entries and duplicate app
 * ids (first manifest wins).
 */
export function parseEpicManifests(
  contents: Array<string | unknown> | null | undefined,
): StoreCandidate[] {
  const seen = new Set<string>();
  const candidates: StoreCandidate[] = [];
  for (const content of contents ?? []) {
    const candidate = parseEpicManifest(content);
    if (!candidate || seen.has(candidate.externalId)) continue;
    seen.add(candidate.externalId);
    candidates.push(candidate);
  }
  return candidates;
}

/**
 * Normalize a pre-scanned candidate array (legacy/fallback source). Only
 * values explicitly present are copied; executable paths are never guessed.
 */
export function parseLibraryEntries(payload: unknown): StoreCandidate[] {
  const entries = (Array.isArray(payload) ? payload : []) as Array<
    Record<string, unknown>
  >;
  return entries
    .map((entry) => ({
      externalId: String(entry.appid ?? entry.id ?? entry.externalId ?? ""),
      title: String(entry.name ?? entry.title ?? "Unknown"),
      installPath: String(entry.installdir ?? entry.installPath ?? ""),
      executablePath: entry.executablePath
        ? String(entry.executablePath)
        : undefined,
    }))
    .filter((entry) => entry.externalId.length > 0);
}

export interface EpicSnapshot {
  manifests?: Array<string | unknown> | null;
  entries?: unknown;
}

/**
 * Combine the raw Epic artifacts into candidates. Returns an empty array when
 * the host supplied nothing: manifest directory discovery itself requires
 * host-side file access (see README "Host requirements").
 */
export function collectEpicCandidates(snapshot: EpicSnapshot): StoreCandidate[] {
  const candidates = parseEpicManifests(snapshot.manifests);
  if (candidates.length === 0) {
    candidates.push(...parseLibraryEntries(snapshot.entries));
  }
  return candidates;
}

/**
 * Epic Games Store library scanner. Detection is injected so it can be
 * unit-tested without touching the filesystem; the desktop host provides real
 * data by reading `%ProgramData%\\Epic\\EpicGamesLauncher\\Data\\Manifests\\*.item`
 * and exposing it via plugin storage. `scan()` returns `[]` when the host has
 * not populated that data.
 */
export class EpicScanner implements StoreScanner {
  id = "epic";
  name = "Epic Games Store";
  store = "epic";

  constructor(
    private readonly detect: () => Promise<StoreCandidate[]>,
  ) {}

  async scan(): Promise<ScannedGame[]> {
    const candidates = await this.detect();
    return candidates.map((candidate) => ({
      externalId: candidate.externalId,
      store: "epic",
      title: candidate.title,
      installPath: candidate.installPath,
      executablePath: candidate.executablePath,
    }));
  }
}

export async function detectFromStorage(
  ctx: ClientPluginContext,
): Promise<StoreCandidate[]> {
  const [manifests, entries] = await Promise.all([
    ctx.storage.get<Array<string | unknown>>(EPIC_STORAGE_KEYS.manifests),
    ctx.storage.get<unknown>(EPIC_STORAGE_KEYS.library),
  ]);
  return collectEpicCandidates({ manifests, entries });
}

export default class EpicPlugin implements ClientPlugin {
  metadata = {
    id: "drop-store-epic",
    name: "Epic Games Store",
    version: "0.1.0",
  };

  async init(ctx: ClientPluginContext): Promise<void> {
    const scanner = new EpicScanner(() => detectFromStorage(ctx));
    ctx.registerStoreScanner(scanner);
    ctx.logger.info("Epic Games Store store scanner registered");
  }
}
