# Epic Games Store

Epic Games Store local library scanner client plugin for Drop (#21).

## Build

```sh
npm ci
npm run build
npm test
npm run typecheck
```

## Host requirements

The Drop plugin API exposes no arbitrary filesystem access, so nothing in this
plugin touches the filesystem or probes the OS. Epic library discovery is a
host responsibility: the desktop host's `game:scan` service must read Epic's
manifests and hand them to the plugin through plugin storage before `scan()`
can return games.

| Method | Requires host `game:scan`? | Input |
| :--- | :--- | :--- |
| `parseEpicManifest`, `parseEpicManifests`, `collectEpicCandidates`, `parseLibraryEntries` | No | Raw `.item` JSON text, parsed objects, or pre-scanned arrays |
| `detectFromStorage` | No (reads `ctx.storage` only) | Host-populated storage keys |
| `EpicScanner.scan` | Indirectly | Whatever the host supplied; `[]` otherwise |

Storage keys the host populates:

- `manifests`: raw `.item` manifest contents from
  `%ProgramData%\Epic\EpicGamesLauncher\Data\Manifests\*.item`
- `library`: optional pre-normalized candidate array (legacy fallback)

Manifests flagged `bIsIncompleteInstall: true` are skipped, and relative
`LaunchExecutable` values are resolved against `InstallLocation`; absolute
executable paths are preserved as-is.
