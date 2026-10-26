# ŚATOR Design Studio — master implementation prompt

Act as a professional fashion designer, product designer and full-stack engineer working on the existing ŚATOR application. Make Design Studio its central creative experience. Inspect the repository and live deployment before changing it. Preserve existing member identities, authentication, saved work, orders and creator relationships. Implement working behavior, migrations and tests, not decorative controls.

## Wardrobe and inspiration

Use exactly two primary collections, **Men’s** and **Women’s**. Anyone may use either collection. Include shared essentials within both; retain compatibility with saved unisex designs.

For men, cover T-shirts, oversized tees, polos, casual/formal/linen shirts, hoodies, knitwear, cardigans, baggy and straight jeans, cargos, chinos, tailored trousers, shorts, joggers, blazers, jackets, coats, waistcoats, kurtas, sherwanis, bandhgalas, draped garments, activewear and accessories.

For women, cover tops, blouses, shirts, camisoles, corsets, knitwear, hoodies, jeans, trousers, palazzos, shorts, skirts, dresses, gowns, jumpsuits, co-ords, tailoring, outerwear, sarees, lehengas, salwar suits, anarkalis, kurtis, fusion wear, activewear, loungewear and accessories.

Provide searchable categories and recognizable garment silhouettes. Label concept illustrations honestly; do not call them production cutting patterns, accurate fit simulations or photorealistic 3D garments. Build a broad, extensible catalogue rather than claiming to include every design in the world.

Make onboarding styles useful immediately. Old Money should show linen, restrained tailoring and refined knitwear; Baggy / Streetwear should show roomy tees, hoodies, cargos and denim; Formals should show shirts, trousers, skirts and blazers. Add meaningful examples for Casuals, Vintage, Custom Tailoring, Minimal and Experimental, in both collections. Use original or appropriately licensed artwork. Each sample must open a fully editable garment document. Do not represent samples as real inventory, real creators or sales.

## Professional creative workflow

Offer Start with a garment and Start with an idea. Provide front/back and applicable detail workspaces, garment and accent colors, illustrative fabrics and patterns, fit/length options, uploaded artwork, drawing, shapes and text. Support Unicode including Telugu and Hindi, font selection, size, spacing, rotation, curved text and alignment. Provide selection, moving, scaling, layers, duplicate, reorder, hide, lock, undo and redo. Clearly explain any illustrative detail view that is not a literal garment construction surface.

Add original artwork presets and optional random inspiration with locks for elements the user wants to retain. Keep generation labels accurate; procedural randomization is not generative AI. Avoid scraped copyrighted designs or copied brand logos.

Save editable private drafts per account, show clear saving/error states, recover unsaved local work and prevent duplicate records when retrying. Publishing must be an explicit action that exposes the selected design to Explore and the creator’s portfolio. Editing a published design should create a private revision/copy until the member explicitly publishes. Preserve remix attribution. Provide usable image exports and editable backups; explain dependencies on uploaded media. Describe PDF concept sheets accurately without claiming they are manufacturing-ready tech packs.

## Explore and member search

Reproduce the reported scenario: Akshaj searches for the registered member Kamal. Verify the correct deployment, account record, discoverability setting, role filter, frontend request, API response and search-index state. Do not invent a root cause or silently create a replacement Kamal account.

Search public names, public label names and exact account IDs across registered buyers, designers and startups. Registration must be sufficient for discovery when the member has chosen to be discoverable; no post or design should be required. Handle whitespace, case, partial names and stale/missing index entries. Provide an explicit People view and a way to clear role filters. Respect search-visibility settings and never search or expose private email, passwords, measurements, drafts or messages. Return useful loading, empty, retry and pagination states.

## Security, integration and delivery

Use the existing backend and identity system. Enforce authentication, owner access, safe same-origin writes, bounded payloads, image ownership and safe rendering. Publishing one image must not expose unrelated private uploads. Validate imported documents and nested image references. Do not claim end-to-end encryption unless it is actually implemented and verified.

Use pinned, reputable open-source dependencies and include licenses. Remain on the existing authorized free deployment; do not enable paid instances, disks, subscriptions or APIs. Report any storage durability limitation instead of promising persistence the hosting configuration cannot provide. Do not merge unrelated sites or databases without evidence that it is necessary.

## Acceptance criteria

1. After login, both collections expose garments beyond tees and hoodies on desktop and mobile.
2. Every supported style offers editable garment samples matching that style; selecting one loads the intended garment, colors and materials.
3. Users can add/edit artwork and text, undo changes, save privately, reopen and explicitly publish. Another member sees only published content.
4. Newly registered discoverable members can be found by name and account ID without publishing, including when their index row is missing. Hidden members remain hidden from search.
5. Existing authentication, drafts, community and creator workflows remain functional. Tests cover real route logic, migrations and cross-account permissions.
6. Check type safety, production build and representative mobile/desktop interactions. Verify the deployed release separately from local tests. Do not create persistent production test accounts without a specifically approved cleanup workflow.
7. Report the live URL, actual changes, completed checks and remaining limitations. Distinguish verified production outcomes from local test evidence.
