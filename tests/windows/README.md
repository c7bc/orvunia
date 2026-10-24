# Local Windows native QA

Manual workflow only. Runs on an ephemeral GitHub-hosted Windows Server2025 x64
machine, never on a developer computer. It neither signs packages nor changes
App Control, certificates, trust, services or the installed production application.
No provider API, microphone, computer-audio recording, camera or desktop capture
is used. Screenshots are captured from the application's own hidden renderers.

Tooling and product commits are separate: this workflow's commit owns these QA
tools; the product source is pinned to d6d95486f6fcc057df437c95304771997bcac0a9,
desktop4.10.3. A separate frozen QA dependency lock installs electron-builder and
Playwright. The pinned public product's own lock/build/runtime audits remain used.
No Cloud source, credentials, reviewer account or production configuration belongs here.

`first-launch` builds and audits Local4.10.3, installs NSIS under a new owned
temporary directory, exercises actual Electron/Bun, begins/ends a synthetic session,
saves history/notes, quits, uninstalls and reopens the unpacked build with the
retained synthetic profile. It does not claim that an older version was upgraded.

`lifecycle` additionally installs the exact historical4.10.1 QA NSIS first. This
binary is pinned by independent SHA256/bytes plus installed ASAR/runtime manifest.
It is not relabeled source rebuilt from an approximate public commit. Supply the
ID of an unpublished draft release with tag qa-baseline-artifact-4.10.1 and the
exact asset recorded in config.mjs. The ephemeral repository GITHUB_TOKEN is used
only by the download step with contents:read. If GitHub denies draft access,
execution stops without publishing the draft or escalating permissions.

The install identity is org.orvunia.qa.followup, distinct from production. Registry
inspection is limited to the exact QA DisplayName and installation ownership.
Final installed files are compared to the full audited unpacked tree; unexpected
obsolete files fail. Profile markers, current/previous notes and session state,
renderer drain and clean process exit are asserted. A quit IPC is requested in a
separate phase; the unchanged smoke can also quit, so causality is not claimed.
Uninstall must remove
the owned executable/registration and retain the external synthetic profile.

All operations require hosted-runner metadata bound to RunID/attempt/toolingSHA.
Child environments exclude tokens, provider keys and production configuration.
The script only requests cleanup of its exact owned installation. Wrapper deadlines
or orphan processes fail the job; disposal of the runner remains the final boundary.
No global process-name kill is used.

Silent uninstall runs a SHA256-verified copy outside the owned install directory.
The documented NSIS `_?=` argument is last, so the process is awaited directly
instead of its temporary self-copy launcher. The hosted QA target must have no
spaces; a different target fails rather than introducing quoted NSIS arguments.
Installer/uninstaller deadlines are600seconds; native-wrapper deadlines stay240.
See [NSIS command-line usage](https://nsis.sourceforge.io/Docs/Chapter3.html#section3.2.2).

Only allowlisted summaries and synthetic renderer PNGs enter the evidence artifact,
retained for one day. Profiles, SQLite, cookies, credentials, raw native logs, install
trees and DevTools output are not uploaded. Workflow console build logs remain
ordinary public CI output; no private token or provider environment enters builders.

A successful job qualifies its Windows Server scope only. It does not certify
Windows11, physical audio, capture protection in another sharing tool, response or
transcription quality, a registered MSIX, Store update/startup, WACK or certification.
The existing application's smoke auto-quit remains unchanged; an early exit is a
real failure, never rewritten as a pass or a substitute response test.

Run the contract tests separately with Node's test runner on tests/windows/spec.
The native operation entrypoints deliberately refuse non-hosted/local environments.
