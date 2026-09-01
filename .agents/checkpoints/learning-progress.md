# Learning Checkpoint — Q&A Forum API

Updated: 2026-09-01

## Project goal

Build the RESTful Q&A Forum API described in `challenge-2.md`:

- user registration, login, and public profiles;
- thread CRUD;
- authentication and authorization;
- only the thread creator may update or delete that thread;
- validation, error handling, PostgreSQL relations, `.env`, and Swagger documentation.

## Chosen stack

- Node.js
- TypeScript `6.0.3`
- pnpm `10.33.4`
- NestJS `11.2.3`
- PostgreSQL
- Drizzle ORM `0.45.2`
- `pg` driver `8.23.0`
- Drizzle Kit `0.31.10`
- Planned later: JWT, bcrypt, validation, Swagger, and tests.

## Current repository state

- NestJS scaffold exists.
- TypeScript 6 is installed locally with pnpm.
- `tsconfig.json` includes Node types and `rootDir: "./"`.
- `tsconfig.build.json` uses `rootDir: "./src"`.
- `pnpm run build` passes.
- `pnpm exec jest --runInBand` passes: 1 suite, 1 test.
- Drizzle/PostgreSQL packages are installed; no application schema or database module has been written yet.
- `@types/pg` is installed as a development dependency.

## Decisions and concepts understood

- The dummy JSON in the challenge is illustrative; the real data will live in PostgreSQL tables.
- One-to-many relation: `users.id` is the parent primary key; `threads.user_id` is the foreign key on the many-side.
- `username` and `email` should both be unique, enforced by database constraints.
- ID format decision: use an internal database ID plus a readable prefixed public identifier (`public_id`, with values such as `U001` and `T...`) to match the challenge examples. Internal IDs will be used for foreign keys and joins; the public identifier will be used at API boundaries. Public-ID generation must be database-safe and must not rely on `row_count + 1`.
- bcrypt hashes passwords one-way; it is not encryption.
- NestJS is the web framework; Drizzle is the ORM; `pg` is the PostgreSQL runtime driver; Drizzle Kit is a migration CLI; `@types/pg` is compile-time type information.
- `pnpm add` adds and installs a new dependency; `pnpm install` installs dependencies already declared; `pnpm list` inspects installed versions.
- `build` compiles TypeScript to JavaScript and checks configuration; Jest checks behavior; ESLint checks code quality.
- `--runInBand` makes Jest run tests serially in one process.
- `pnpm-workspace.yaml`/`catalog:` are for multi-package workspaces; this project is currently a single package.
- Detailed ID design note: `.agents/checkpoints/id-architecture-note.md`.

## Confirmed data-model decisions

Internal ID/public identifier separation is the selected learning approach: UUID
internal IDs plus database-backed sequences for `U...` and `T...` values stored in
`public_id`. Public IDs use uppercase prefixes, minimum three-digit padding, may
expand beyond `999`, are unique, and are never reused. Do not use `count + 1`
because concurrent requests can collide.

When a user is deleted, the database will use `ON DELETE CASCADE`: all of that
user's threads are deleted as well. This prevents orphaned threads, but is a
deliberate data-loss behavior that must be protected by authorization and tested.

## Mentor operating rules

- Read and follow `AGENTS.md` before repository actions.
- Use Context7 for library/setup/documentation questions.
- Prefer lean-ctx for repository reads, searches, and shell output.
- Use the `ponytail` skill: shortest correct solution, no unnecessary abstractions.
- Explain the single next step before acting.
- Preserve learner involvement in data modeling, relationships, authorization, and other architectural decisions.
- Do not store secrets in checkpoints.

## Identifier naming decision (2026-08-31)

The final column name will be `public_id`. Its values are readable prefixed codes
such as `U001` and `T001`. `public_code` would be a more precise name for the
value's format, but `public_id` is a valid and common external-identifier name.
The important rule is consistency across database, DTOs, URLs, tests, and docs.

## Next mentoring step

The digital ERD has passed structural review. Before writing application code,
review the mapping from each ERD decision to the Drizzle schema: primary keys,
`public_id` uniqueness, required fields, `threads.user_id` foreign key with
`CASCADE`, and timestamp ownership/defaults. After that mapping is understood,
we can create the schema file and only then configure/generate a migration.

## Digital schema-tool research (2026-08-27)

- Recommended for this design stage: **dbdiagram.io**. It provides a live visual
  ERD from DBML, supports PostgreSQL import/export, and can export a diagram or
  generate SQL. A DBML file can also be kept in the repository as a reviewable
  design artifact.
- Visual/no-DBML alternative: **drawDB**. It is a free, open-source browser ERD
  editor with PostgreSQL support and SQL import/export; its open-source editor
  stores diagrams locally in the browser, so important diagrams must be exported.
- Later verification tool: **DBeaver**. It is better after PostgreSQL tables exist,
  because its ERD is generated from an existing database/schema.

Working recommendation: use dbdiagram.io for the blueprint, then treat the
Drizzle schema and migrations as the implementation source of truth. Never put
credentials or other secrets into any diagram.

## Decision timeline

| Date | Milestone | Status/reason |
|---|---|---|
| 2026-08-26 | NestJS project scaffolded with pnpm | Base application is ready. |
| 2026-08-26 | TypeScript 6 adopted | Local compiler verified; build and Jest pass. |
| 2026-08-26 | PostgreSQL + Drizzle stack selected | `drizzle-orm`, `pg`, and `drizzle-kit` installed. |
| 2026-08-26 | One-to-many model understood | `threads.user_id` references the internal `users.id`. |
| 2026-08-26 | Internal UUID + public code selected | Keeps database relations technical while matching the challenge's readable IDs. |
| 2026-08-26 | Public-code and user-delete policies confirmed | Uppercase `U`/`T` codes; `ON DELETE CASCADE` for a user's threads. |
| 2026-08-27 | Digital ERD tool researched | dbdiagram.io recommended for design; DBeaver reserved for post-migration verification. |
| 2026-08-31 | ERD structural review passed | Two-table one-to-many model is coherent; implementation details remain. |
| 2026-08-31 | Next step narrowed to schema mapping | Translate the approved ERD into Drizzle concepts before writing or migrating. |
| 2026-09-01 | Documentation asset location selected | Use `docs/assets/` for the ERD image; keep checkpoints separate from project docs. |
| 2026-09-01 | README database documentation added | README links the ERD/DBML and explains tables, constraints, identifiers, and cascade behavior; implementation remains pending. |
| 2026-09-01 | Git workflow audit | Local `main` has no commits, the configured `origin` is empty, and `.gitignore` is still needed before the initial commit. |

The timeline records meaningful decisions only. The sections above remain the
source of truth for the current state and pending work.

## Scope refinement (2026-08-31)

The dummy JSON is a minimum reference, not a fixed schema or API contract. We may
improve the design when the improvement has clear value and remains proportional
to this challenge.

### High-value improvements kept in scope

1. Database integrity: primary/foreign keys, `NOT NULL`, unique username/email/
   public code, cascade behavior, and indexes needed by real queries.
2. Boundary validation: trim/normalize inputs, validate email/password/title/
   content, and enforce reasonable length limits.
3. Consistent API behavior: clear `400`, `401`, `403`, `404`, and `409` responses;
   never return `password_hash` or secrets.
4. Authentication/authorization: bcrypt, JWT configuration from environment,
   owner derived from the authenticated user, and ownership checks on update/delete.
5. Useful metadata: timezone-aware `created_at`/`updated_at` and deterministic
   ordering for thread lists.
6. Minimal critical tests: duplicate registration, invalid input, login, owner vs
   non-owner update/delete, missing resource, and user-delete cascade.
7. `.env`/`.env.example` hygiene and Swagger documentation for success and error
   cases.

Basic pagination can be added after the core list endpoint works; it is not a
reason to delay the first implementation.

### Deliberately out of scope for now

Refresh-token rotation, roles/admin, email verification, password reset, comments,
votes/tags/notifications, soft delete (we selected cascade), CQRS/event buses,
Redis, microservices, elaborate repository abstractions, audit logging, and custom
rate limiting/observability. Revisit these only when a requirement or deployment
context justifies them.

## Concept checkpoint: `CASCADE` vs transaction (2026-08-31)

`ON DELETE CASCADE` is a foreign-key rule: deleting a parent `users` row makes
PostgreSQL delete all `threads` rows that reference it. It prevents orphaned
threads, but it is intentionally destructive and must be protected and tested.

A transaction is an all-or-nothing boundary around one or more database
operations. A single SQL statement is already atomic in PostgreSQL, so an
explicit transaction is not needed for every simple create/read/update/delete.
Use one when one business action performs multiple dependent writes, such as
creating a user and a profile together. A cascade can execute inside that same
database atomic operation; cascade and transaction solve different problems.

## Architecture status (2026-08-31)

The database architecture has not fundamentally changed:

- entities remain `users` and `threads`;
- the relationship remains one user to many threads;
- internal UUIDs remain the database identifiers and `U...`/`T...` remain public
  identifiers;
- `threads.user_id` still references the internal `users.id`.

The change is a referential-action policy: that foreign key now uses
`ON DELETE CASCADE`. Constraints, indexes, timestamps, and validation make the
same model safer; they do not introduce new entities or a new architecture.
Transactions are runtime behavior, not a schema relationship, and do not change
the database architecture.

## Clarification: user profile vs `profiles` table (2026-08-31)

The current design has no separate `profiles` table. In this challenge, a public
profile is simply a safe response/projection of a row from `users` (for example,
public code, username, and creation time); `username` is a column in `users`.

The earlier user-plus-profile example was generic. If a future design added a
separate `profiles` table, a one-to-one relationship would need a unique
constraint on the profile's user reference (or a shared primary key). A
transaction would additionally ensure that creating the user and profile either
both succeeds or both rolls back. A transaction alone does not enforce “exactly
one profile”; the relationship constraint does that.

## ERD review checkpoint (2026-08-31)

The learner's first digital ERD has the correct two tables, UUID primary keys,
timestamps, and one-to-many direction (`1` user to `n` threads). Before treating
the blueprint as final, make these corrections:

- rename `threads.users_id` to `threads.user_id`;
- keep `public_id` as the agreed external identifier in both tables;
- mark `public_id`, `username`, and `email` as unique and required;
- make `threads.user_id` required and keep its type equal to `users.id` (`UUID`);
- change the foreign key's delete action from `No action` to `CASCADE`;
- keep `On update: No action`, because internal UUID primary keys are immutable.
- remove `UNIQUE` from `threads.title` and `threads.content`; different threads
  may legitimately share either value;
- `PRIMARY KEY` already implies unique and not-null for `id`, so the extra flags
  are redundant (harmless, but omit them for a minimal schema).

The chosen `VARCHAR` lengths, bcrypt hash storage type, sequence generator, and
API response mapping are implementation details to review after the structural
blueprint is corrected. The diagram does not need to show a separate `profiles`
table.

The latest ERD revision resolves the structural corrections: `threads.user_id`,
`public_id` naming, no uniqueness on thread title/content, and
`ON DELETE CASCADE`. The relationship is ready for implementation review.

Remaining details are implementation-level rather than new entities: database
defaults for timestamps, sequence-backed generation of `public_id`, the index on
`threads.user_id`, email normalization, and automatic maintenance of
`updated_at`.

## Documentation plan (2026-09-01)

Project documentation belongs under `docs/`, separate from `.agents/checkpoints`.
Use `docs/assets/` for the exported ERD image. Keep the README concise: show the
image, summarize the two-table relationship and key constraints, and link to a
longer design note if needed. An editable schema export may be kept beside the
image, but never include credentials or secrets.

## Documentation implementation checkpoint (2026-09-01)

`README.md` now documents the current database blueprint, links to
`docs/database-schema.dbml`, and embeds `docs/assets/database-erd.png`. It states
clearly that the Drizzle schema, migrations, and API endpoints are still pending;
the README is documentation of the approved design, not a claim that those
features already exist.

## Git workflow checkpoint (2026-09-01)

Git concepts for this project: a commit is a reviewed local snapshot; push sends
those commits to the configured remote. The repository currently has no local
commits and `origin` has no remote branches, so the first push will publish the
initial project history. Before staging, add a `.gitignore` for `node_modules/`,
build/test output, TypeScript build info, logs, and environment secrets. Review
the staged file list and run the existing build/test checks before committing.
