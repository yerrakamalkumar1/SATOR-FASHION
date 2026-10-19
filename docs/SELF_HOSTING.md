# ŚATOR: portable open-source software stack

This is a prepared deployment target, not a completed migration. Render publication
remains a separate deployment step from publishing the source repository.
The existing Sites deployment continues using D1/R2; its data has not been copied,
deleted or moved. No paid infrastructure or API key has been provisioned.

## Selected implementation

| Layer | Selection | Why |
| --- | --- | --- |
| UI and server | Existing React, TypeScript and Next.js; standalone Node 24 | Reuses the working app with a standard server runtime. |
| Records and search | SQLite, including the existing FTS5 search | Preserves SQLite queries, transactions, migrations and search. PostgreSQL is a later scaling option requiring a real schema/query migration. |
| Uploaded files | Private persistent disk, immutable UUID directories | Simple single-instance storage with the existing ownership checks and byte-range video responses. Files are never served from `public/`. |
| AI | Existing compatible API adapter, extended for self-hosted llama.cpp-compatible endpoints | Supports assistant, translation, vision and structured concept results without requiring an OpenAI API key. The chosen model must support the requested capability and schema. |
| Speech | whisper.cpp-compatible server and browser PCM WAV capture | Consent-based 30-second mono recordings; editable transcripts in search and design. No browser proprietary speech-recognition service is invoked. |

SQLite is public-domain software. Node.js, Next.js/React, llama.cpp and whisper.cpp
publish open-source code. Model weights have separate licenses: runtime licensing
does not establish a model's openness or its suitability for commercial use.
No particular text/vision model is bundled or represented as licensed/tested.
This does not assign a public distribution license to the owner's application code.

The portable runtime disables hosted OpenAI and Razorpay credentials. Payment
requests and collaboration remain available; a real bank/payment gateway remains
an external service and is not described as open source. ChatGPT sign-in is hidden
and incoming platform identity headers are ignored on the Node build. Existing
email/password sign-in and recovery keys work independently of ChatGPT.

## Build and run

Use Node 24.19 and the package manager pinned in `package.json`:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm run build:node
SATOR_DATA_DIR=/absolute/private/persistent/sator HOSTNAME=0.0.0.0 PORT=3000 pnpm run start:node
```

`SATOR_DATA_DIR` is mandatory. The first database access applies checked migrations;
modified historical migrations stop startup instead of silently changing data.
`/api/health` checks storage availability. Use HTTPS with a trusted reverse proxy;
secure session cookies and microphone capture require it in normal deployment.

`Dockerfile` and `compose.yaml` provide an alternative container deployment. The
data volume must be writable by UID 1000. Compose binds to localhost; add a trusted
HTTPS reverse proxy for access from other machines. Do not expose the data folder.

## Render preparation

`render.yaml` prepares one Node service with a 10 GB disk and automatic deployments
disabled. The paid `starter` plan is an example configuration to review before
creating the service; no service has been created. A persistent disk requires a paid
Render service and cannot be shared by multiple instances. Render remains a hosted
infrastructure provider even when the deployed application uses open-source software.

This first target is deliberately a single-instance deployment. It is not a
multi-region or horizontally scaled design. Render disk deployments have a brief
restart window. As load grows, measure write concurrency and storage before moving
to PostgreSQL and an object store such as Garage. Do not run several Node replicas
against separate local disks and expect their users or files to stay synchronized.

## Optional AI and speech connections

Configure the environment shown in `deploy/self-hosted.env.example` on the server.
There are no secrets in that template. `AI_BASE_URL` is the llama.cpp-compatible
base ending in `/v1`, and `SPEECH_BASE_URL` is the whisper.cpp server base (the app
adds `/inference`). Text and image models can be configured separately.

External endpoints require HTTPS and a service token. A private service network
can use HTTP only with `SATOR_ALLOW_PRIVATE_AI=true` on the Node deployment. This
setting should be used only for endpoints controlled by the operator. URLs are
server settings, never user-supplied request fields; redirects are rejected.

Start the upstream `llama-server` and `whisper-server` with model files on a machine
with sufficient memory and compute. Keep model ports private. For Whisper choose a
multilingual model, not an English-only `.en` model, for Telugu and Hindi. Validate
language accuracy on representative consented samples before calling voice ready.
Model files and external services are not automatically downloaded or started by the
app. CPU/GPU inference, model licenses and physical microphone behavior remain
deployment checks; mocked contract tests are not evidence of real model quality.

Audio is kept in browser/server memory for one request. The application stores no
audio and writes no transcript automatically. Audit upstream speech-server logging,
temporary files and retention separately. Daily quotas are shared with other AI
operations; failed requests may still consume an allowance.

## Backup and migration

Stop writes, then create a new snapshot directory:

```sh
SATOR_DATA_DIR=/var/data/sator node scripts/backup-node.mjs /private/backups/sator-2026-10-19
```

The tool uses SQLite's backup API and copies the private media directory. Protect
and encrypt off-server copies. Restore a tested snapshot only while the app is
stopped. Never copy only a live `.sqlite` file while ignoring its WAL.

Moving existing production data is still a separate operation: export D1 records
and R2 objects with their owner/content-type metadata, preserve all IDs, map the
applied migration history, validate row and object counts/checksums, test ownership
and account access in staging, then choose a cutover window and rollback plan.
ChatGPT-only identities need a verified account-transition process; never link
them to email accounts merely because an email string matches. Do not point the
new server at an empty database and describe it as an existing-data migration.

## Upstream references

- https://www.sqlite.org/copyright.html
- https://nodejs.org/docs/latest-v24.x/api/sqlite.html
- https://nextjs.org/docs/app/guides/self-hosting
- https://github.com/ggml-org/llama.cpp
- https://github.com/ggml-org/whisper.cpp
- https://github.com/ggml-org/whisper.cpp/blob/master/examples/server/README.md
- https://render.com/docs/disks
- https://render.com/docs/blueprint-spec
