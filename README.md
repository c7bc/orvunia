<div align="center">
  <img src="assets/brand/logo.svg" width="72" alt="Orvunia logo" />
  <h1>Orvunia</h1>
  <p>An open-source AI assistant for interviews and meetings.</p>
  <p><a href="https://orvunia.com/en/">Website</a> · <a href="https://orvunia.com/en/docs/">Guides</a> · <a href="https://orvunia.com/en/download/">Downloads</a> · <a href="https://github.com/c7bc/orvunia/issues">Issues</a></p>
</div>

[![Public core](https://github.com/c7bc/orvunia/actions/workflows/verify.yml/badge.svg)](https://github.com/c7bc/orvunia/actions/workflows/verify.yml)
[![MIT license](https://img.shields.io/badge/license-MIT-126c50)](LICENSE)

Capture microphone and computer audio, ask questions with context, and keep
your history on your own computer. Choose the providers that handle your
transcription, text, and images. The personal core requires no Orvunia account.

[Guias em português](https://orvunia.com/pt-BR/docs/) · [Guías en español](https://orvunia.com/es/docs/)

## See the interface

[![Orvunia interface with sample data](https://orvunia.com/demo/interface.png)](https://orvunia.com/demo/interface.webm)

Recorded with sample data. Audio and AI services are not connected. The transcript
and responses are scripted examples from the actual product renderers in an
isolated browser. [Watch the 16-second walkthrough](https://orvunia.com/demo/interface.webm)
or inspect its [provenance](https://orvunia.com/demo/provenance.json).

## What you can do

| During a session | After a session |
| --- | --- |
| Transcribe microphone and system audio | Search local conversations and notes |
| Ask about speech, images, documents, or approved code | Reuse context in follow-up questions |
| Choose separate transcription and answer providers | Keep your own provider connections |
| Use desktop shortcuts and capture protection where supported | Export and review your work |

Use the [interactive website demo](https://orvunia.com/en/) to explore the
conversation and technical modes. Its examples are illustrative; it does not
record audio or call an AI provider. Capture protection depends on the operating
system and sharing tool. It does not guarantee invisibility.

## Run from source

Requires **Bun 1.4.3**. PostgreSQL and Redis are not needed for the personal core.

```sh
git clone https://github.com/c7bc/orvunia.git
cd orvunia
bun install --frozen-lockfile --ignore-scripts
bun run build
bun start
```

Open the loopback address printed in the console. In **AI providers**, configure
an answer connection and a transcription connection. Your provider bills API
usage directly. Local history is not sent to Orvunia Cloud by this installation.

Windows desktop installers are separate release artifacts. The
[download page](https://orvunia.com/en/download/) lists published options and
their signing status when available. A source archive is not an installer.
Google sign-in and Google Calendar are coming soon; local reminders remain available.

## Personal core or Cloud?

| Personal core — this repository | Orvunia Cloud — separate service |
| --- | --- |
| Free, MIT-licensed source | Hosted account and managed AI usage |
| Your providers and local profile | Subscription allowances and usage limits |
| Runs without an Orvunia account | Private server implementation |

Read the [Cloud guide](https://orvunia.com/en/docs/cloud/) for availability and
usage terms. The website has its own repository. Cloud authentication, billing,
hosted quotas, and operating configuration are excluded from this public core.

## Development

```sh
bun run check
bun run test
```

Tests use synthetic fixtures. Opt-in end-to-end checks live in `next/tests/e2e/`;
review the flags in each file before running checks that download model weights.
Keep credentials, real conversations, and production profiles out of fixtures.
For a contribution, describe the problem, make a focused change, and include
the checks that reproduce it. Follow [AGENTS.md](AGENTS.md).

<details>
<summary>Local model runtimes and Docker</summary>

The reviewed automatic runtime setup targets Windows x64: `bun run models:setup`.
Runtime downloads have pinned versions and SHA256 verification. The active
model-weight catalog is currently empty: previously evaluated weights are
retired from new downloads or imports. Existing installations can still be used
or removed; their weights, history, and bindings are preserved.

Other systems can use provider APIs or manually configured compatible runtimes.
Set the absolute path, SHA256, and pinned version through
`ORVUNIA_LLAMA_RUNTIME_PATH`, `ORVUNIA_LLAMA_RUNTIME_SHA256`, and
`ORVUNIA_LLAMA_RUNTIME_VERSION`, or the corresponding `ORVUNIA_WHISPER_RUNTIME_*`
variables for transcription. Capacity estimates do not guarantee model quality.

On Linux, build the personal Docker image and preserve its loopback bind:

```sh
docker build -t orvunia-personal .
docker run --rm --network host -v orvunia-personal:/data orvunia-personal
```

On Windows, use `bun start` or a published desktop build. Do not expose the
personal API publicly. Do not point an older runtime at an upgraded profile.

</details>

## License

[MIT](LICENSE) covers project code. Dependency and asset licenses remain in
[THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt) and the included asset notices.
