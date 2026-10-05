# Vitest advisory maintenance · 2026-10-05

The authorized development dependency update is complete. `vitest` and `@vitest/mocker` moved from **3.2.7 to 4.1.11**, the fixed stable version for [GHSA-82fw-gwwq-j7x9](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9). The direct manifest entry changed from `^3.2.4` to exact `4.1.11`. No runtime dependency, Vite version, application/test source, test selection or build script changed. No compatibility configuration change was necessary; real CSS processing remains enabled.

## Applicability and scope

The old package versions fell within the advisory's affected range. The documented unauthenticated path uses the standalone public mocker/interceptor plugin. This workbench runs `vitest run` and does not configure either plugin or browser-mode mocks. That limits the observed configuration's exposure; it does not make the old dependency version patched. The installed 4.1.11 mocker checks Vite's `isFileLoadingAllowed` before reading a redirected file.

Official npm metadata and the [Vitest 4 migration guide](https://v4.vitest.dev/guide/migration) were checked before installation. Existing Node 25.4.0 and Vite 7.3.6 meet the package requirements. Only `npm install --save-dev --save-exact vitest@4.1.11` and its required dependency changes were applied. No force, legacy-peer override, broad upgrade or audit-fix command was used.

The lockfile changes are **2 added, 10 removed and 13 updated packages**, all from the required development dependency graph. The seven companion `@vitest/*` packages are 4.1.11; obsolete `vite-node` and related packages were removed. Full exact versions and the reviewable change are retained in [package-changes.json](evidence/vitest-maintenance/package-changes.json) and [dependency-update.patch](evidence/vitest-maintenance/dependency-update.patch).

## Verification

- `npm test`: **160 tests across 9 files passed** on Vitest 4.1.11. No tests or checks were disabled.
- `npm run lint`: passed.
- `npm run build`: passed, including `tsc -b`, backend `tsc -p tsconfig.backend.json`, and the production Vite build. Production asset hashes match the preceding build.
- Fresh `npm audit --json`: **zero known vulnerabilities** across installed dependencies.
- Supported local-browser smoke: reloaded the existing synthetic Story draft, edited its title, verified the rendered text, undid the edit, and reloaded to confirm the original title persisted. Desktop and mobile preview each decoded all five image placements without overflow; no browser console errors were reported. The mobile iframe body measured 388px and desktop 926px inside the editor. No native transport/unlock attempt was made.

Logs, exact package versions and screenshots are in [the verification summary](evidence/vitest-maintenance/summary.json) and [browser smoke report](evidence/vitest-maintenance/browser-smoke.json).

Existing warnings remain visible: Node's experimental SQLite warning, Zod PURE-comment annotation warnings, and the 569.01 kB production chunk warning. None was suppressed or reclassified as a pass.

## Recovery and outstanding decisions

The previous manifest, lockfile and Vite config are saved in `docs/recovery/pre-vitest-4.1.11/`. They are historical recovery data containing the affected version, not the active installation. Restoring them would reopen the advisory and should only be used to diagnose a demonstrated compatibility regression.

Native review-panel checks still require the user to **unlock the Mac manually**. They must use synthetic content in an isolated environment; the artist library remains untouched. Hosting ownership/provider, region and beta budget, plus authentication/exposure/recovery choices, remain outstanding before cloud provisioning; see [production decisions](PRODUCTION-DECISIONS.md). The product remains a local workbench. No hosting, accounts, domain purchase, billing, remote push or publication was performed.
