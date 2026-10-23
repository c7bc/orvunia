<div align="center">
  <img src="assets/brand/logo.svg" width="80" alt="Orvunia logo" />
  <h1>Orvunia</h1>
  <p><strong>The open-source AI interview assistant with an undetectable desktop mode.</strong></p>
  <p>Hear the question. Connect the context. Find your next answer.</p>
  <p><a href="https://orvunia.com/en/">Website</a> · <a href="https://orvunia.com/en/docs/">Documentation</a> · <a href="https://orvunia.com/en/download/">Downloads</a> · <a href="https://github.com/c7bc/orvunia/issues">Issues</a></p>
</div>

[![Public core](https://github.com/c7bc/orvunia/actions/workflows/verify.yml/badge.svg)](https://github.com/c7bc/orvunia/actions/workflows/verify.yml)
[![MIT license](https://img.shields.io/badge/license-MIT-126c50)](LICENSE)

Bring live speech, screenshots, documents, and code into one interview workspace.
Orvunia helps you turn that context into streamed answers, focused follow-ups,
and notes you can return to. Run the open-source core with your own AI providers,
or choose the separately hosted Orvunia Cloud service.

[![Orvunia conversation and technical interview workspace](https://orvunia.com/demo/readme.png)](https://orvunia.com/en/#demo)

[Watch the walkthrough](https://orvunia.com/demo/interface.webm) · [Try the interactive demo](https://orvunia.com/en/)

## One app. Two modes.

| Conversation mode | Technical mode |
| --- | --- |
| Work through recruiter and behavioral questions | Reason through code, debugging, and system design |
| Shape experiences into STAR answers | Explain a screenshot or a selected piece of code |
| Ask follow-ups and recap the discussion | Suggest tests, improvements, and implementation approaches |
| Add your profile, documents, and instructions | Bring approved repository files into the conversation |

Switch between the built-in modes or create your own. Give a mode its own
instructions, reference documents, and note sections so the assistant follows
the kind of conversation you are preparing for.

## Keep the conversation moving

| Feature | What it gives you |
| --- | --- |
| **Speech to context** | Transcribe microphone and computer audio; use the selected speech in a question. |
| **Streamed answers** | Read the answer as it arrives and continue with focused follow-ups. |
| **Visual questions** | Attach screenshots and ask about the code, interface, or problem on screen. |
| **Your reference material** | Add profile details, documents, and mode instructions to shape the response. |
| **Desktop overlay** | Keep a movable assistant window and global shortcuts close to the conversation. |
| **History that stays useful** | Search sessions, edit notes, revisit transcripts, and export your work. |
| **Your language** | Use the interface in English, Portuguese, or Spanish; choose transcription and answer languages separately. |

### Undetectable desktop mode

The desktop app requests native window exclusion from supported captures.
Use it with the overlay and keyboard shortcuts to keep your workspace focused.

### Ask about your repository

Connect a repository, review the files, and approve the context you want to use.
The repository agent can list, search, and read that approved snapshot to ground
its answer in your code. Ask where behavior lives, how a flow works, or what a
change would involve, with file and line references you can inspect.

Repository access is read-only: code suggestions remain yours to review and apply.

## Your AI, your setup

| Run the open-source core | Use Orvunia Cloud |
| --- | --- |
| MIT-licensed source in this repository | Separately hosted service |
| Start without an Orvunia account | Sign in to your hosted workspace |
| Bring your own provider connections | Managed AI usage and account features |
| Keep the personal profile and history locally | Choose a plan with published usage allowances |
| Run the local web app or desktop runtime | Use the hosted Cloud interface |

The personal core needs neither PostgreSQL nor Redis. Your API provider bills
your usage directly. Cloud authentication, billing, hosted quotas, and deployment
configuration live in a separate private product.

[Explore the Cloud guide](https://orvunia.com/en/docs/cloud/) · [See desktop download availability](https://orvunia.com/en/download/)

## Get started

Install **Bun 1.4.3**, then run:

```sh
git clone https://github.com/c7bc/orvunia.git
cd orvunia
bun install --frozen-lockfile --ignore-scripts
bun run build
bun start
```

Open the loopback address printed in the console.

1. In **AI providers**, configure an answer connection and a transcription connection.
2. Choose a mode and add the profile or reference material you want to use.
3. Start a session, capture audio or add context, and ask your first question.

### Choose a provider or a local endpoint

| Capability | Available connection types |
| --- | --- |
| Answers | OpenAI, Anthropic, Gemini, Groq, OpenRouter, Ollama, and compatible APIs |
| Transcription | OpenAI, Groq, Deepgram, AssemblyAI, and compatible APIs |

Choose transcription and answer connections independently. For local generation,
connect an existing Ollama or compatible server and select a model suited to
your hardware. The built-in catalog currently offers no new model-weight downloads;
existing local installations and manually configured runtimes remain available.

<details>
<summary>Optional local runtimes and Linux Docker</summary>

`bun run models:setup` prepares the pinned llama.cpp and whisper.cpp runtime
executables for Windows x64, with SHA256 verification. It does not add model weights.
For manual runtimes, configure the path, version, and hash using the
`ORVUNIA_LLAMA_RUNTIME_*` or `ORVUNIA_WHISPER_RUNTIME_*` settings.

On Linux, the personal web app can run with a persistent profile volume:

```sh
docker build -t orvunia-personal .
docker run --rm --network host -v orvunia-personal:/data orvunia-personal
```

The personal API binds to loopback. Native overlay, capture protection, and
global shortcuts belong to the Electron desktop runtime.

</details>

## Built to be understood and extended

Orvunia is an independently built product with a modular TypeScript core:
Bun and Elysia run the backend, TypeScript powers the interface, SQLite stores personal data,
and Electron provides the desktop integration. Provider adapters keep AI
connections separate from session and conversation behavior.

| Path | Role |
| --- | --- |
| `client/` | Interface, modes, notes, audio controls, and streaming views |
| `next/apps/personal/` | Personal server and local application composition |
| `next/packages/` | Domain logic, providers, context, history, and desktop modules |
| `next/db/sqlite/` | Local database migrations |
| `desktop/` | Electron bootstrap and generated native bundles |
| `scripts/` | Build, runtime packaging, and integrity tooling |

## Documentation and contribution

[English guides](https://orvunia.com/en/docs/) · [Guias em português](https://orvunia.com/pt-BR/docs/) · [Guías en español](https://orvunia.com/es/docs/)

Found a bug or have an idea? [Open an issue](https://github.com/c7bc/orvunia/issues)
with the behavior you expected and steps to reproduce it. For a contribution,
keep the change focused, explain the result, and follow [AGENTS.md](AGENTS.md).

```sh
bun run check
bun run test
```

## License

The public core is [MIT licensed](LICENSE). Dependency and asset licenses are
listed in [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt) and included notices.
