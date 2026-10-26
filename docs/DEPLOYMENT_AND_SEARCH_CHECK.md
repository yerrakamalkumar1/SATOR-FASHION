# Deployment and member-search check — 26 October 2026

The completed studio upgrade is on `codex/advanced-design-studio` in draft PR #1. The live Render release remains unchanged. Do not interpret local tests or the review branch as a verified production release.

## Verified account evidence

Read-only inspection of the existing Sites project's `profiles`, `member_preferences`, `search_index` and `portal_accounts` found:

- Public display name: **Kamal Ceo**.
- Search visibility: enabled (`discoverable=1`).
- Public person search-index entry: present.
- Portal role: customer. A Designers-only filter would exclude this account; All, Buyers or the new People view is appropriate.

These findings belong to the earlier ChatGPT-hosted site at https://sator-fashion-studio.akshajaddandi.chatgpt.site, which uses its existing D1 database. They do not prove that the account exists in the separate Render SQLite database. The cause of the user's Render search result remains unverified until an existing member signs into that deployment. No accounts were recreated or joined by matching email addresses, and no databases were merged.

## Data preservation constraint

Render's dashboard identifies the service as Docker Free and states that persistent disks are unsupported. This application's Node runtime stores accounts in SQLite and uploaded media below `SATOR_DATA_DIR` on the local filesystem.

Render documents that free-service local files are lost on redeploy, restart **and spin-down**. Pausing a deployment is not a backup. Free services also lack SSH/dashboard shell access, and the currently deployed application has no full-database export endpoint. The repository's backup script requires access to the running storage directory; it cannot retrieve it through the public health endpoint.

A safe release requires an accessible backup/export of existing data plus durable database and media storage, with a restore check preserving IDs and access controls. Creating a blank store or switching URLs is not a migration. No paid instance, disk, subscription, new external storage account or production test account has been created.

Official references checked on this date:

- https://render.com/docs/free
- https://render.com/docs/disks
- https://render.com/docs/ssh

## Follow-up validation

The additional garment controls and workspace regression passes alongside the ten existing studio scenarios. TypeScript and the standalone Node production build pass. Browser inspection confirms trousers have front/back workspaces and no neckline/sleeve controls. Existing non-sleeved detail layers retain editable, explicitly illustrative workspaces.

PDF output is labeled **concept sheet**, excludes inapplicable sleeve previews, and invalidates prepared exports after design changes. Generation reaches a prepared download button. PNG export downloads successfully. Automated PDF download capture timed out; the cloud browser blocked opening the resulting blob URL under its protocol policy. PDF download/render verification remains incomplete and is not claimed as passing.

## Hosted migration follow-up

The `0012_studio_preferences.sql` file existed, but its schema declaration, Drizzle journal entry and snapshot were missing. The prior tests scanned every SQL file, matching the Node adapter; using Drizzle's actual journal reader instead reproduced a 503 when saving studio preferences. This is a release-candidate defect, not a verified explanation of the unchanged live Render site.

The existing SQL is preserved byte-for-byte and is now registered in the journal with its schema and generated snapshot. A regression checks journal coverage, real studio route behavior and preservation of existing identities, private drafts, orders, follows and preferences across the migration. All 99 automated scenarios pass: 12 studio, 45 community, 18 creative, 11 functional and 13 authentication. Both the Cloudflare Worker and standalone Node production builds pass, as does TypeScript.

The original ChatGPT-hosted project remains active with its existing DB and BUCKET bindings. It is a possible existing-host release destination, but using its address would not migrate Render-only accounts or uploads. No hosting switch, database merge, paid service or production deployment has been performed. Confirm the intended public destination before changing which site the user should use.

The Render browser did not show a signed-in member after the handoff; it showed an account-creation form. No new account was submitted. Live Render member search remains unverified.
