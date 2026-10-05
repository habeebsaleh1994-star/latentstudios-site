# Trustworthy local publishing foundation — implemented milestone

Canonical workspace: `latent-studio-workbench`, port **5181**, application **0.6.0**, document/backup schema **5**, immutable revision envelope **1**, portable website envelope **2**.

## Implemented locally

- Named immutable checkpoints store the validated document, source draft revision, timestamp, name, frozen original media blobs, and a media manifest. Local releases add dimensions and film duration discovered during browser preflight. No original is silently transcoded.
- A separate atomic local-release pointer names one immutable checkpoint. Draft edits and restores cannot change it. Advancing a release checks both the current draft revision/content and expected previous release pointer.
- Recovery UI lists checkpoints and retained migration/import records, shows a structural comparison and desktop/mobile preview, and restores as a new draft. Before restoration it atomically preserves the current draft as a new checkpoint. Media are copied to fresh IDs; imported ID collisions cannot overwrite an existing original. Every backup import also retains its previous draft in a uniquely keyed recovery record.
- Metadata: website title, description, language tag, optional canonical HTTPS address. The address is metadata, not domain connection.
- Preflight checks missing files/placeholders, browser-decodable media, media type mismatches, empty titles/navigation labels, duplicate labels, empty destinations, language/URL validity, alt descriptions, solid-color text/accent contrast, and a film caption/transcript reminder. Errors block release/export; observations keep the artist in control. Review is cancellable, decoders have a 15-second per-file limit and preflight has a 60-second budget.
- Portable editable JSON backups support versions 1–5. A paste-and-validate path avoids native file chooser dependence. Unsupported MIME and malformed structures are rejected before mutation. SVG is accepted only when its byte hash matches one of the three bundled geometric originals; arbitrary SVG, HTML and script payloads are refused.
- Self-contained HTML export includes the release's renderer, CSS, document, route map, title/description/language/canonical metadata and embedded original media. It runs independently of the editor's origin and IndexedDB. JavaScript is required; it is not a server-rendered SEO bundle or hosting service. The export runtime loads only when requested.
- Draft/media/revision repository interfaces preserve the local revision/conflict contract. All write transactions explicitly abort and consume failures; successful UI receipts follow transaction completion.

## Local limits and deliberate deferrals

Browser storage is scoped to origin and profile and can be cleared or evicted. Checkpoints/recovery records are retained without automatic pruning. Keep external backups; a draft/edition backup does not contain the entire revision library. Browser disk-download completion is not verified by the app.

Limits: 30 MB per imported/uploaded media file, 90 MB backup input, 60 MB total media for a new checkpoint/release, 100 megapixels per decoded image. Single-file export uses base64; the new folder ZIP uses separate responsive media. Large-project stress testing, actual device quota exhaustion/power-loss tests, multi-browser/physical-mobile/screen-reader audits, transcoding, captions authoring, CDN delivery and public SEO indexing remain future work. Local display derivatives and responsive sets are implemented in 0.6.0; browser sRGB encoding is an explicit reviewed option. Lazy image loading/async decoding and metadata-only film preload are real; there is no CDN or adaptive video.

Comparisons are document-structural, not pixel comparisons. Copies made during restoration may show changed media references even when the visible image matches. Older recovery records retain their original document and asset references; modern named checkpoints/releases freeze the media inside the revision. There is no deletion/GC UI.

Four complete visual directions remain implemented. Six further style entries remain architectural. No account, cloud storage, public site, share link, domain/subdomain, billing or integration service is provisioned.

## Before real hosting or accounts

The later decisions are concrete: service/account ownership; deployment destination and recurring cost ceiling; storage region if relevant; single-owner versus collaborators; who may receive review links and with what expiry/revocation policy; the domain/subdomain and its DNS owner; and the exact work/revision approved for upload and exposure. Domain purchase, DNS changes, paid services and publishing need their own authorization. Do not reuse the live manuscript domain, or The Moment/Field infrastructure, by default.

A remote adapter must provide tenant authorization, media ownership, immutable content-addressed assets, conflict checks, atomic release manifests, authenticated and revocable review access, retention/recovery semantics, and failed-upload cleanup. These contracts are requirements, not mocked services.

The next selective-integration step is the [read-only Ritual Stories import plan](RITUAL-STORIES-IMPORT-PLAN.md). It is grounded in located source rules and does not assume an existing JSON package or authorize changes to Ritual.

0.6.0 adds original-preserving, explicitly prepared display copies and folder ZIP delivery with source hashes and byte receipts. See [verification](VERIFICATION.md) and [architecture](ARCHITECTURE.md). Ritual import remains blocked on a supported structured interchange; no fabricated importer was added.
