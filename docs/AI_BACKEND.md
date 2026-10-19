# ŚATOR backend intelligence release

The initial backend release preserved the interface and consumed server-generated scores in the existing For you sort/filter operations. The subsequent explicitly requested search and appearance release adds mic/camera controls, section motion and account appearance preferences. Unrelated labels, branding, original stylesheets and the fitting-room privacy promise are preserved.

## Active without an external model

- SQLite FTS5 public-catalog search with BM25 relevance, title/creator boosts, prefix matching, garment synonyms, accent handling and bounded one-edit spelling correction.
- Natural-language INR upper-budget filters, including decimals and `2k` notation. Unpriced concepts remain eligible because they require a quote; quoted amounts are not invented.
- Literal member-name search, including buyers. Unknown queries return empty results. Search visibility settings apply.
- The public index backfills existing data and updates in the same transaction as publication, edits, deletion, profile renames and visibility changes. Private drafts, chats, measurements, orders and support requests are excluded.
- Content-based cosine matching uses the actual declared style percentages. Zero-weight niches no longer incorrectly boost designers. Blocked members are excluded from recommendations in either direction. Up to the newest 1,000 catalog items receive server scores; the existing declared-tag ranking handles remaining items and service failures.

These are statistical retrieval and content-matching algorithms, not a newly trained neural model. The existing on-device MediaPipe camera tracking remains unchanged.

## Model-backed services, pending configuration

The assistant retains the existing **Use AI replies** opt-in and guide fallback. The backend supports OpenAI Responses and a secured OpenAI-compatible model server such as vLLM. No model credentials were present when this release was prepared. A simulated protocol test is not evidence of live inference or model quality.

`GET /api/intelligence` reports configuration flags to signed-in users. Flags mean configuration exists, not that a provider has passed a live health or quality check.

`POST /api/intelligence` accepts an owned asset:

```json
{"action":"recognize","asset":"/api/assets/<owned-upload-uuid>","consent":true}
```

It verifies authentication, origin, ownership, image type/signature and the 5 MB limit. It never fetches arbitrary user-supplied URLs. Model output must conform to fixed garment/color/pattern/style enums. Unclear images yield no recommendations. Catalog results are resolved from current published records; recognition does not verify materials, sustainability, fit or authenticity.

The new search-camera dialog also sends a raw JPEG, PNG or WebP body with `X-Sator-Photo-Consent: true`, after the user previews and explicitly consents to processing. The raw body is stream-limited to 5 MB, signature checked and passed directly to the provider without creating an R2 upload. The UI disables recognition and explains its unavailable state when no provider is configured. Camera preview remains local. The existing fitting-room flow is separate and continues to keep photos on the device.

Images are sent as inline bytes only after per-request consent. Recognition attributes are cached per user, content hash and configured model for one hour; raw images and assistant chat bodies are not added to the AI cache. Expired entries are pruned during subsequent recognition requests. The original uploaded asset retains the app's existing storage lifecycle.

## Runtime setup

Use hosted runtime secrets, never client bundles, source files or chat messages containing API keys.

OpenAI:

- `AI_PROVIDER=openai` (or leave unset)
- `OPENAI_API_KEY` (secret)
- `OPENAI_MODEL` (an enabled model supporting the Responses text API)
- `OPENAI_VISION_MODEL` (an enabled image-input model supporting strict JSON-schema output)

The supported OpenAI Developers `openai-platform-api-key` setup supplies credentials when the plugin is installed and the required approval completes. Merely recommending or authorizing installation does not install the plugin or activate inference. Redeploy after setting runtime variables.

Open-source model server alternative:

- `AI_PROVIDER=compatible`
- `AI_BASE_URL=https://<secured-model-host>/v1`
- `AI_API_KEY` (secret; use an authenticated deployment)
- `AI_MODEL` and `AI_VISION_MODEL` (the server's actual served model IDs)

The endpoint must implement `/chat/completions`, text and image content, strict `response_format.json_schema`, and `finish_reason=stop`. Validate the selected model's license and capabilities before hosting it. This code does not provision a GPU service or download model weights. CLIP is a possible separate image/text embedding approach, but it is not deployed or claimed as active here. Its weights do not fit a dependable drop-in use inside the existing 128 MB Worker runtime.

Operational controls:

- 15-second model timeout; redirects rejected; output body capped at 128 KB.
- At most 700 output tokens per request; low-detail image input.
- Photo requests: three per minute per member. Translation: six per minute. Existing assistant limit remains ten per minute.
- Default daily inference allowances: 30 per member and 500 per site. Configure `AI_DAILY_USER_LIMIT` / `AI_DAILY_SITE_LIMIT` to change within bounded maxima. Failed inference attempts count. Counts limit calls, not exact currency spend; set provider billing limits independently.
- `AI_DISABLED=true` disables inference without disabling catalog search. Redeploy to apply configuration changes.
- No credentials, raw images or chat prompts are logged by these adapters. OpenAI requests set `store:false`; this is not a claim of universal zero retention. For a self-hosted server configure its own request logging and retention.

## Validation and activation gate

Run `node tests/intelligence.mjs` for public-index lifecycle, privacy, budget, relevance, matching, provider contracts, cache, failure, quotas and preservation of unrelated JSX and original CSS. Run `node tests/search-experience.mjs` for account appearance isolation, strict preference validation, translation contracts and cancellation, direct photo consent and size limits, motion preferences and theme application. Existing application suites must also pass, followed by TypeScript and the production build.

## Search and appearance controls

- The existing search bar now has microphone and camera buttons. Voice input records a bounded PCM WAV clip only after consent and sends it to `/api/transcribe`, which connects to a configured whisper.cpp-compatible server. A typed transcript is always available. The application does not persist audio.
- Spoken and output language selectors include English, Telugu, Hindi, French, Chinese and fifteen others. Selection is not a guarantee of browser support or recognition quality. On-device translation is feature detected for each language pair. When available, it produces a chosen-language review and an English catalog query; otherwise the configured model can translate only after explicit text-processing consent. Original text remains searchable when translation is unavailable.
- `POST /api/translation` checks same-origin authentication, explicit consent, supported language codes, text length, per-minute and daily quotas. Only the submitted text and language choices are sent. Structured output is validated. Unavailable or invalid responses produce explicit errors, not fabricated translations.
- Appearance settings provide light/dark/system themes, three text sizes, comfortable/compact spacing and reduced motion. Migration `0009_curious_white_queen.sql` adds account preference columns with defaults. Per-account local caching restores preferences promptly; server storage persists them across devices. Sign-out and account changes reset the active appearance appropriately.
- Section transitions use the Web Animations API without remounting forms. OS reduced-motion and the account preference disable motion. Closing search or hiding the page stops camera/microphone access and cancels pending work.
- `scripts/generate-appearance-styles.mjs` regenerates the additive theme and text-size overrides from the original CSS. It excludes product artwork and camera surfaces from automatic color transformations.

Automated tests use simulated browser/provider contracts and do not establish physical-device support, actual model accuracy, microphone/camera permissions or visual layout quality. Real-phone checks are still required, including narrow screens, dark-mode contrast, large text, speech-language support and camera orientation.

Before calling inference live: configure the selected provider, exercise opted-in assistant chat and an owned consented image with actual credentials, check outputs on representative clothing/non-clothing images, measure latency and costs, and test on real phones. Real model accuracy and physical-device checks are still outstanding. No new model is trained from private user data in this release.

## Primary implementation references

- https://developers.cloudflare.com/d1/sql-api/sql-statements/
- https://www.sqlite.org/fts5.html
- https://developers.openai.com/api/docs/guides/images-vision
- https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses
- https://docs.vllm.ai/en/v0.21.0/features/multimodal_inputs/
- https://huggingface.co/sentence-transformers/clip-ViT-B-32

`0008_intelligent_retrieval.sql` is a custom SQL migration for the FTS virtual tables, synchronization triggers and AI counters/cache. Preserve it in future schema generation; the virtual tables are intentionally not represented in Drizzle's ordinary table model.

## Editable concept composer

`POST /api/concepts` accepts an explicitly consented brief and an optional owned reference image. The existing OpenAI or OpenAI-compatible provider adapter returns schema-validated colors, typography, a supported motif, a tee/hoodie template and a designer brief. No account history, wardrobe, measurements or private conversations are sent. Results do not automatically create a project, publish a design, message a member or change an order. Unsupported physical garment details are retained as instructions for a designer.

The new form can save a private brief/project without any model provider. A disconnected provider disables generation and explains why. Microphone transcription now uses the self-hosted speech adapter. It stays disabled until a server is configured; physical-device and multilingual model checks remain required.

Provisioning status: key creation and local destination were approved, but the required secure helper could not be located. No OpenAI key or live provider configuration was created. Keep generation labeled unavailable until provisioning and a real authenticated model request succeed.


## Standalone open-source deployment

See `SELF_HOSTING.md` for the Node/SQLite/private-disk target, model and speech environment settings, backups, and deployment limits. This target uses compatible self-hosted inference and disables hosted OpenAI/Razorpay credentials and ChatGPT identity-header trust. It is prepared for review, not yet deployed or populated with existing production data.
