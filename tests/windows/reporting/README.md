# Native clipboard and reporting QA

This manual-only job builds the public Local product pinned to core d6d954 and
desktop4.10.3. Tooling source is separate. No product source or existing package
is modified. It launches the actual audited QA unpacked executable with existing
candidate-runtime/profile options on an official disposable Windows Server2025
runner. This is packaged candidate mode, not the default integrated or Store mode.

Only a new owned physical profile is used. The pinned public profile constructor,
SQLite migration and SqliteSessions repository create one explicitly synthetic
ended session and answer containing a small TypeScript code block. No provider,
microphone, computer audio, camera, screenshot input or repository context is used.
The fixture and credentials are never inserted into production or product bundles.
The seed identity token stays only in the temporary profile, never in evidence.

The actual dashboard opens that saved session. The actual text/code copy buttons
must show Copied feedback, and Electron's native clipboard readback must exactly
match the selected content. The actual report modal must block an empty reason,
start without the answer selected, cancel without effects, allow an editable
excerpt/preview, and copy that preview through the real native preload/IPC.

Only the final shell.openExternal adapter is deliberately replaced in the running
test process by a recorder that rejects. Real sender/lifecycle checks and the
production URL builder remain in use. This covers the native argument boundary
and fallback UI; it does NOT send an OS launch request, open a real email draft or
send a message. No mail handler is installed, reassigned or registered to fake a pass.
The original adapter is restored only after the entire interaction completed
successfully. On any failure or timeout the rejecting stub remains installed until
the process exits: a timed-out pending click cannot dispatch to the real shell.
Permission requests are denied by an
additional test guard; no audio/camera permission or provider behavior is qualified.

The runner gets no provider/auth/billing keys. Child environments are allowlisted.
The UI does use its local HTTP backend; zero refers to paid provider calls, not HTTP.
After launch, a stricter request guard permits loopback reads, onboarding and
normal save/drain requests restricted to the exact synthetic session only;
any other attempted request fails the run. It makes no claim about pre-attach traffic.
There is no auto-smoke timer to suppress; existing non-smoke candidate mode is used.
App/version/profile/ASAR hashes are checked before interaction. Explicit app quit
is awaited; the separate cleanup step rejects remaining owned runtime executables.
Only our exact expected clipboard values are cleared. The disposable runner is the
final cleanup boundary; no global process kill or user-profile deletion is used.

Each operation has a recorded fixed stage and an explicit deadline. The native
workflow step also has a five-minute ceiling; cleanup has two minutes. A progress
file survives even if cancellation prevents finally from completing. Failed-stage
metadata and an own-renderer screenshot are attempted with a separate short bound;
they never delay quit indefinitely. No exception payload, URL, DOM text or token is
placed in the progress file. A timeout or missing cleanup remains a failure.

Evidence contains sanitized reporting/cleanup/build summaries and own-renderer screenshots
of the application's own renderer, not the desktop. No profile, SQLite, cookies,
identity file, raw native logs, fixture state or DevTools output is uploaded.
An assertion failure remains a failure. The artifact expires after one day.

A green result qualifies Windows Server native clipboard and the instrumented
reporting boundary only. Windows11 hardware, real mailto handling, MSIX/Store,
DPAPI migration, AI quality and end-to-end support delivery remain separate gates.
