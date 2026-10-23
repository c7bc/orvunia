# Cadence engineering instructions

These instructions apply to this project and its subdirectories. Explicit user
instructions take precedence. Communicate progress and results in pt-BR.

## Engineering rules

- Apply SOLID, especially Single Responsibility and Dependency Inversion.
- Keep functions small, focused, and free of side effects where practical.
- Use clear, explicit, intention-revealing names. Avoid abbreviations.
- Prefer readability, maintainability, and correctness over cleverness or
  micro-optimizations.
- Keep modules cohesive and responsibilities clearly separated.
- Keep business rules separate from infrastructure, I/O, and framework code.
- Make dependencies explicit. Use constructor or function injection where useful.
- Use strict TypeScript and well-defined contracts between modules.
- Avoid unnecessary abstractions, speculative features, and overengineering.
- Avoid global mutable state and hidden dependencies.
- Prefer single-word file and directory names. Use kebab-case for multiple words.
- Keep tests in separate test directories, outside production source files.
- Each maintained source file must have at most 200 lines. Split larger files
  into focused modules instead of compressing code to satisfy the limit.
- Existing oversized legacy files are migration work: when migrating their
  behavior, split it into compliant files and preserve its behavior with tests.
  Do not expand those files or treat their current size as a pattern to copy.
- Do not generate placeholder logic or TODOs unless explicitly requested.

## Architecture

- Use layered or clean architecture where it clarifies dependencies:
  domain, application, and infrastructure.
- Domain code must not depend on frameworks, databases, HTTP, environment
  variables, provider SDKs, or infrastructure implementation details.
- Controllers and entry points coordinate flow; business rules belong in
  domain/application modules.
- Write self-explanatory code. Briefly explain non-obvious decisions.
- Assume long-term maintenance by other engineers.
- Preserve the approved modular monolith. Do not introduce microservices,
  NATS, gRPC, or another project's specifications without user direction.

## Approved migration direction

- Product ownership follows ADR 034: the public Orvunia core is independent of
  the private Orvunia Cloud product. Cloud authentication, billing, subscriptions,
  hosted quotas and platform operation must not ship as public source or bundles.
- The current mixed workspace is private migration input, not a publishable
  community repository. Never publish it wholesale or bypass the export boundary.
- Preserve shared core behavior and keep cloud dependencies directed toward the
  public core. A feature flag or frontend-hidden control is not source separation.
- Public builds and tests must work without the private repository. Do not remove
  local speech capture, BYOK providers, history or onboarding to hide cloud code.

- Bun and TypeScript; Elysia; Zod; Drizzle.
- PostgreSQL for cloud; SQLite for a simple personal local installation.
- Better Auth for cloud identity; no mandatory personal-local account.
- Redis and BullMQ for cloud coordination/background work. Neither is required
  for the personal desktop installation.
- React Email templates; Brevo delivery initially; explicit provider adapters
  allow SES, Resend, and other transports when required.
- API and worker are separate processes of the same modular backend.
- Electron retains native capabilities and supervises a separate Bun backend.
- Preserve current application behavior and user data during migration.
- Do not silently switch the installed application to an incomplete backend.
- Use the architecture proposal in ../cadence-backend-design-v1.html and the
  project ADR/spec index as the migration context.

## Verification and operation

- Read relevant specs, ADRs, code, dependencies, and existing tests before edits.
- Identify reused infrastructure and genuinely missing capabilities.
- Test meaningful invariants, ownership, idempotency, concurrency, cancellation,
  failure handling, migrations, and recovery with appropriate real dependencies.
- Keep secrets, personal data, local credentials, and research artifacts out of
  public source packages, logs, test reports, and fixtures.
- Run migrations on isolated test databases before touching real data.
- Preserve a baseline and a rollback path before replacing runtime or storage.
- Record what was implemented, what was verified, and remaining limitations.
- User authorization to execute the approved migration is already present.
  Do not ask for approval again after each routine change.
