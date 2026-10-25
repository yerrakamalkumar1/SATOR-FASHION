# Advanced design studio

The existing post-login Design studio now opens a Fabric.js editor for customers, creators and startup members. Existing accounts, onboarding, community, orders and Render deployment remain in place.

## Included

- 175 editable concept templates under two main collections: Men’s and Women’s (shared essentials are included in both), including Indian ethnic and fusion categories. Templates use parametric SVG silhouette families; these are concept illustrations, not production cutting patterns or unique photorealistic garment meshes.
- 48 original editable garment samples across Old Money, Baggy / Streetwear, Formals, Casuals, Vintage, Custom Tailoring, Minimal and Experimental. The personal feed initially selects the strongest style preference; each sample opens the actual garment document in the studio.
- Design Yourself, Design an Idea, nine style packs, a searchable catalogue, saved drafts and community remix starting points.
- Four independent design surfaces: front, back and two sleeve workspaces. Sleeves are illustrative print workspaces, including when the chosen garment has no physical sleeves.
- Fabric.js object selection, drag, scale, rotate, freehand drawing, text, curved text, custom colors, uploaded images and shapes. Properties include opacity, outline, spacing, mirror, repeat, layer order, hide, lock, duplicate and basic group horizontal movement.
- 118 font choices, 300 seeded slogans including Telugu/Hindi, 13 pattern choices and eight illustrative fabric textures. Google-hosted font choices load on demand; the system-font fallbacks work when a web font cannot load. Random designs are procedural, not generative AI.
- Fictional monograms made from initials and original shapes. These are not trademark clearance results. No Pinterest scraping or copied brand logos.
- Same-origin image uploads with the existing size/type protections. Optional white-color removal is a simple browser pixel filter, not AI background segmentation.
- Private auto-save every 30 seconds; explicit publishing to Explore and creator portfolios. A published design is not auto-published again while editing. Saving edits to a published design creates a separate private draft.
- PNG mockups, transparent artwork PNG, a two-page PDF concept tech pack with measurement placeholders, and validated editable JSON backup/import. PNG exports render text through the same Fabric code as the editor. PDFs provide a prepared download link.
- Existing likes, collections/lookbooks, public creator names and profiles remain available. Remix source IDs are retained in the document.

## Member discovery

Explore includes a People tab that searches every account type. Name, brand and exact public account-ID matching can return registered members without published work even if their full-text search row is absent. Search-visibility preferences still apply. Filtered empty results offer Search all members. This is a tested resilience improvement, not a confirmed diagnosis of a particular production account.

## Data and access

The optional `studio` property extends the existing validated DesignConfig JSON. Legacy T-shirt and hoodie designs still render and migrate into editable layers. No account migration is required. `0012_studio_preferences.sql` adds an account-owned garment-catalogue preference and is applied by the existing Node migration runner.

`GET /api/studio` returns the authenticated catalogue and preference, optionally filtered by `audience`. `POST /api/studio` accepts validated `preference` or `random` requests with same-origin protection and rate limiting. Saves and publishing continue through `/api/store`. `createId` provides idempotent initial saves. Uploaded images in all layers require ownership or existing published access. Project revision paths have the same nested-artwork protection.

The design JSON is not end-to-end encrypted. Existing HTTPS transport, password hashing, protected session cookies and owner-scoped private records remain the security model. The current free Render deployment still has ephemeral SQLite/media storage. An editable backup references uploaded images by their original asset paths; export PNGs to retain portable visual copies. Durable cloud storage is a separate configuration task.

## Dependencies and deployment

Fabric.js 7.4.0 and jsPDF 3.0.4 browser bundles are pinned and self-hosted in `public/vendor`, alongside their MIT licenses. No paid API, provider account, API key or subscription is needed for this module. Existing package versions and the frozen lockfile are unchanged.

Build: `node scripts/build-node.mjs`. Start: `node .next/standalone/server.js`. Retain the deployed public-origin environment setting used by the signup repair. Deploy the updated repository to the existing Render free service. Do not enable a paid disk or instance without a separate request.

## Validation

- `node node_modules/typescript/bin/tsc --noEmit`
- `node tests/community.mjs` — cross-account discovery, new profiles without indexed rows, literal IDs and visibility protection.
- `node tests/studio.mjs` — catalogue coverage, random locks, preference isolation, layered save/read, idempotency, draft isolation, publish/remix and malicious/nested artwork validation.
- `node tests/functional.mjs` — existing store, permissions and quote flows.
- `node tests/creative.mjs` — existing private wardrobe, collaboration, revisions and artwork permissions.
- `SATOR_TEST_INTERNAL_ORIGIN=http://0.0.0.0:10000 node tests/email-auth.mjs` — signup/login/logout behind the Render proxy origin.
- Browser UI checks use an isolated local harness with test saves. They do not prove that the update is deployed or that live Render storage is durable.
