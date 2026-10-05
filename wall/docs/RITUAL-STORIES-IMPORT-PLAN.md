> Historical investigation, superseded by the authorized local exporter/importer work in [RITUAL-BRIDGE.md](RITUAL-BRIDGE.md). The earlier blocker below records what existed before that work; it is no longer the current implementation status.

# Ritual Stories → website: source investigation and exact blocker

**No importer was implemented:** the inspected source exposes PDF output, not a supported versioned Story + media interchange. Guessing JSON from internal Swift structs, parsing a PDF, or scraping a catalog would not establish a faithful import. The website work continued with local media delivery.

Read-only checkout: `/Users/habibsaleh/Documents/Latent`, observed HEAD **ba08b925b**, 2026-10-04 UTC. Applicable AGENTS instructions were read. Only focused model/export/design source was inspected; no live catalog, user artwork, native build, simulator or running Ritual app was opened. No other Latent product, memories or configuration changed. The Moment and Field remain outside scope.

## Verified source rules

- `RitualCore/Sources/RitualCore/LatentStory.swift`: roles single/full-bleed/breath/pair-left/pair-right; unknown roles degrade to single. Membership caption `nil` inherits image caption seed; empty string is deliberate silence; nonempty text is authored. These states must not collapse into one empty/missing field.
- `RitualCore/Sources/RitualCore/LatentStoryDocument.swift`: optional opening title/standfirst/cover; ordered frame pages; adjacent left/right become a spread; orphan pairs retain raw role on an individual frame.
- `LatentCore/LatentLibrary+Sequences.swift:19–125`: internal sequence ID, name, ordered image IDs, dates, title/standfirst, members and cover image ID. Membership has image ID, caption, role, **private intent**, optional canvas coordinates. IDs are library-scoped integers, not portable global identity. Database membership order uses position; sparse spacing is a storage detail. Soft-deleted images are filtered from in-memory reads while durable member/cover references remain. The private intent field is expressly excluded from reading-room/PDF output and must never silently become website content.
- `LatentMac/LatentMacApp.swift:1022–1068`: Story menu export resolves the active sequence and captions through the pure model, allows **PDF** in NSSavePanel, obtains editor preview images via the sheet-export runner, then writes LatentStoryPDF.
- `LatentPad/App/PadStoryModeView.swift:158–225`: Make book produces a cancellable temporary PDF from ordered pages and pane preview/thumbnail. Unready media can show Developing. This is not an interchange package.
- `LatentMac/LatentExportDialog.swift:593–635`: contact-sheet PDF/PNG proof export and ordinary image export, not structured Story export.
- `docs/plans/2026-05-17-story-mode-design.md`: older plan explicitly excludes web/scrollytelling export. Current call sites, rather than the age of that plan alone, support the blocker.

A focused search of relevant Swift source found no supported Story JSON/manifest/media-package exporter. `loadLightTableViewStateJSON` in the sequence extension is layout state, not Story interchange. This is a source finding, not a claim that every possible branch, external tool or running build was exhaustively inspected.

## Required upstream contract before implementation

An authoritative versioned export must establish stable exported story/frame identity, source product/version, exact ordered frames, cover identity, raw role, resolved display caption **and** inheritance/authored/silence provenance, approved rendered media files with MIME/dimensions/hash/color information, and explicit omission rules for unavailable images. Private intent and unsupported canvas metadata must be excluded by default. Rendered outputs must be approved for web use; original camera files are not implicitly authorized.

These are requirements to agree with Ritual, **not an invented accepted schema**. A synthetic package emitted by the real exporter and its contract/version owner are the concrete missing deliverables. No user catalog is needed to establish them.

Once supplied: validate without mutation → preview exact incoming sequence and mobile interpretation → capture the outgoing website draft → import into a new project/draft with fresh website IDs → retain source provenance → compare re-import explicitly. Opening maps to project title/introduction/optional cover, frames to ordered image blocks, valid pairs to a two-work section. Full-bleed/breath and orphan-pair interpretations require visible review. Preserve intentional silence, never bake a new crop, never overwrite source media or synchronize back to Ritual.

The user still needs to choose new project versus new site and approve any departure from the source story's mobile pacing. No integration button is presented as a working service.


## Proposed public interchange design — documentation only

A future publication-approved export should contain only a versioned public document identity, reviewed title/standfirst, ordered public frame identities, raw layout roles, explicit cover, caption text with inheritance/authored/silence provenance, approved rendered media references with MIME/dimensions/content hashes, and an artist approval receipt describing the selected edition/media set. This is an allowlist design, not an implemented JSON schema, accepted upload format or existing Ritual exporter.

Exclude private intent notes, local catalog/file paths, credentials, raw databases, hidden/deleted records and private image metadata such as location unless explicitly approved as public content. Media files must be deliberate rendered exports. Do not infer permission to publish original camera files. The actual exporter owner must agree the semantics and emit a synthetic package before a preview-first website importer can be implemented. No Ritual source was changed in the backend increment.
