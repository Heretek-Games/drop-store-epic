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
 * Epic Games Store library scanner. Detection is injected so it can be unit-tested
 * without touching the filesystem; the desktop host provides real paths via
 * `ctx.serverRequest`/`ctx.system` in a full build.
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

export function parseLibraryEntries(payload: unknown): StoreCandidate[] {
  const entries = (Array.isArray(payload) ? payload : []) as Array<Record<string, unknown>>;
  return entries.map((entry) => ({
    externalId: String(entry.appid ?? entry.id ?? entry.externalId ?? ""),
    title: String(entry.name ?? entry.title ?? "Unknown"),
    installPath: String(entry.installdir ?? entry.installPath ?? ""),
    executablePath: entry.executablePath ? String(entry.executablePath) : undefined,
  }));
}

export default class EpicPlugin implements ClientPlugin {
  metadata = {
    id: "drop-store-epic",
    name: "Epic Games Store",
    version: "0.1.0",
  };

  async init(ctx: ClientPluginContext): Promise<void> {
    const scanner = new EpicScanner(async () =>
      parseLibraryEntries(await ctx.storage.get<unknown>("library")),
    );
    ctx.registerStoreScanner(scanner);
    ctx.logger.info("Epic Games Store store scanner registered");
  }
}
