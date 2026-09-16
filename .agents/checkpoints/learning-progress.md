# Learning Checkpoint — Q&A Forum API

Updated: 2026-09-16

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
- Drizzle/PostgreSQL packages are installed; learner-created `src/database/schema.ts` exists. The reviewed initial migration has been applied to `qa_forum`; Prettier formatting, public-ID generation, and API implementation remain pending.
- `@types/pg` is installed as a development dependency.
- Initial project commit exists and is pushed from `codex/docs-database-readme` to `origin`.
- Detailed setup/CLI reference is maintained in `.agents/checkpoints/project-setup-cli.md`.
- Schema definition and reasoning reference is maintained in `.agents/checkpoints/drizzle-schema-thinking-guide.md`.

## Decisions and concepts understood

- The dummy JSON in the challenge is illustrative; the real data will live in PostgreSQL tables.
- One-to-many relation: `users.id` is the parent primary key; `threads.user_id` is the foreign key on the many-side.
- `username` and `email` should both be unique, enforced by database constraints.
- ID format decision: use an internal database ID plus a readable prefixed public identifier (`public_id`, with values such as `U001` and `T...`) to match the challenge examples. Internal IDs will be used for foreign keys and joins; the public identifier will be used at API boundaries. Public-ID generation must be database-safe and must not rely on `row_count + 1`.
- Primary keys already imply uniqueness and non-nullability. `users.public_id`, `users.username`, `users.email`, and `threads.public_id` are unique; `threads.user_id` must not be unique because multiple threads belong to one user.
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

## Environment configuration mental model (2026-09-15)

`.env` is a text file containing configuration values such as `DATABASE_URL`; it
is not the database and should not be committed when it contains secrets.

There are two separate processes in this project:

1. **Drizzle Kit CLI** — runs when commands such as `drizzle-kit generate` or
   `drizzle-kit migrate` are executed. `drizzle.config.ts` directly imports
   `dotenv/config`, so this CLI process can read `.env` and connect to PostgreSQL.
2. **NestJS runtime** — runs when the API starts. It does not execute
   `drizzle.config.ts` and does not automatically share the CLI process's
   environment-loading step. NestJS therefore needs its own configuration setup.

`dotenv` is the small loader: importing `dotenv/config` reads `.env` and places
the values in `process.env`. It does not create a NestJS provider or a
`ConfigService`.

`@nestjs/config` is the NestJS integration. `ConfigModule.forRoot()` uses dotenv
internally, loads `.env`, and makes configuration available through injectable
`ConfigService`. It is a runtime dependency. Keeping both packages is deliberate:
the direct `dotenv` import belongs to the CLI config, while `@nestjs/config`
belongs to the application runtime. A transitive copy of dotenv inside another
package should not replace a direct dependency that the project imports itself.

### Why `ConfigModule.forRoot({ isGlobal: true })` belongs in `AppModule`

`import { ConfigModule } from '@nestjs/config'` is a TypeScript import: it makes
the `ConfigModule` symbol available in `app.module.ts`. Adding
`ConfigModule.forRoot(...)` to the Nest `imports` array is a separate action: it
tells Nest to initialize that module when the application starts. Both are
needed because TypeScript must know the symbol and Nest must register the module
in its dependency graph.

`forRoot()` performs the one-time root setup: it loads `.env`, merges it with
environment variables supplied by the operating system, and registers
`ConfigService`. Later, a database provider can inject `ConfigService` and read
`DATABASE_URL` without manually loading dotenv in every file.

`isGlobal: true` changes scope, not behavior. Without it, every feature module
that injects `ConfigService` must list `ConfigModule` in its own `imports`. With
it, the root registration is available throughout this application. It does
not create a database connection, expose secrets to clients, or make values
global to the operating system. It is a deliberate small-app simplification for
cross-cutting configuration; omitting it is also valid when explicit per-module
imports are preferred.

The functional minimum is `ConfigModule.forRoot()`. We choose the global scope
because configuration is needed by the database and later authentication/JWT
providers, and repeating the same import would add boilerplate without creating
a useful boundary for this challenge.

## Database provider mental model (2026-09-16)

There is currently no database provider file in the project; it is the next
runtime integration piece to create. A NestJS database provider is a managed
object factory, not a table definition and not a migration. Its intended jobs
are to read `DATABASE_URL` from `ConfigService`, create the PostgreSQL/Drizzle
client once, and make that client injectable for feature services.

The responsibilities are deliberately separated:

- `schema.ts` describes tables and gives Drizzle query types.
- Drizzle migration files change the PostgreSQL database structure.
- `ConfigModule` loads runtime configuration.
- The database provider creates the application's live Drizzle connection.
- A `DatabaseModule` later registers and exports that provider to other modules.

Creating the provider does not create tables and does not run migrations. It is
also preferable to creating a new `Pool` inside every service, which would
duplicate configuration and connection resources. The official Drizzle pattern
uses the installed `pg` driver (often an explicit `Pool`) and passes it to the
node-postgres Drizzle adapter.

The chosen flow is:

```text
drizzle-kit command → drizzle.config.ts → dotenv → process.env → PostgreSQL
NestJS start       → AppModule → ConfigModule → ConfigService → Drizzle → PostgreSQL
```

Using only `dotenv` inside NestJS would work for a small app, but would leave
configuration access scattered through `process.env` and would not provide
Nest's standard injection/validation boundary. Using `@nestjs/config` for the
runtime keeps that boundary without changing how Drizzle CLI commands load
their configuration.

## Nest watch/build diagnostic (2026-09-16)

The first `pnpm run start:dev` attempt compiled with zero TypeScript errors but
then failed with `Cannot find module 'dist/main'`. The repository has
`nest-cli.json` configured with `deleteOutDir: true` and `tsconfig.json` with
`incremental: true`. Nest removes `dist`, while TypeScript can reuse the
`tsconfig.build.tsbuildinfo` cache and decide that the deleted JavaScript output
is already up to date. The experiment `tsc -p tsconfig.build.json
--incremental false` emitted `dist/main.js` and the other expected files,
confirming that the failure is an output/cache interaction, not a provider or
database error. For this small project, removing the speculative incremental
optimization (and clearing its generated cache) is the lean fix; then rerun the
normal Nest build/watch command.

## Identifier naming decision (2026-08-31)

The final column name will be `public_id`. Its values are readable prefixed codes
such as `U001` and `T001`. `public_code` would be a more precise name for the
value's format, but `public_id` is a valid and common external-identifier name.
The important rule is consistency across database, DTOs, URLs, tests, and docs.

## Next mentoring step

The learner-created initial migration is now applied to the configured `qa_forum`
database and the resulting tables/constraints have been verified in pgAdmin. The
learner has registered `ConfigModule`, wired the custom Drizzle provider/module,
and verified NestJS runtime bootstrap. The separate startup `SELECT 1` smoke
query is intentionally skipped: database connectivity was already verified
outside the application, and it is not a challenge requirement. The next guided
exercise is the first required feature: user registration.

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
| 2026-09-01 | Git workflow completed | Added `.gitignore`, created `codex/docs-database-readme`, committed the initial project snapshot, and pushed it to `origin`. |
| 2026-09-01 | Schema mapping retrieval check | PK/FK direction and cascade were recalled correctly; corrected that `threads.user_id` must remain non-unique in a one-to-many relationship. |
| 2026-09-01 | Unique-constraint mapping clarified | Primary keys are implicitly unique; `users.public_id`, `threads.public_id`, `users.username`, and `users.email` are the explicit unique fields. |
| 2026-09-01 | Timestamp behavior clarified | System time supplies the values; `created_at` is set on insert, while `updated_at` must be refreshed on each successful thread update. |
| 2026-09-01 | Generated schema reverted | Learner prefers guided implementation; the generated schema file was removed while the approved ERD/README remain. |
| 2026-09-01 | Guided schema implementation started | Learner will write the Drizzle schema incrementally, beginning with `users`, with review after each meaningful section. |
| 2026-09-01 | Setup CLI checkpoint added | Added a repeatable setup guide covering NestJS scaffolding, pnpm commands, verification, environment boundaries, and Git hygiene. |
| 2026-09-01 | Setup reference expanded | Reconciled the learner's cheatsheet with the repo guide: stack status, `--skip-git`, `--strict`, TS6 config, scaffold files, command semantics, and `--runInBand` trade-offs are now explained. |
| 2026-09-01 | Guided `schema.ts` syntax resumed | Drizzle documentation was checked; the learner will write `users` first with PostgreSQL builders, then add `threads` and its cascade foreign key after review. |
| 2026-09-01 | Property/column mapping clarified | A Drizzle object key such as `publicId` is the TypeScript name, while `'public_id'` is the PostgreSQL column name; constraints are chosen from the ERD and requirements, not added arbitrarily. |
| 2026-09-01 | Import workflow clarified | Senior workflow is flexible: imports conventionally live at the top, while VS Code auto-import can add them after a symbol is typed; Drizzle PostgreSQL builders come from `drizzle-orm/pg-core`. |
| 2026-09-01 | Duplicate autocomplete entries explained | The installed Drizzle package is a single `0.45.2` version; its dual ESM/CJS declaration exports can make VS Code show `pgTable` twice. Select one suggestion and keep one named import. |
| 2026-09-01 | Drizzle tooltip reading clarified | Read a chained builder left-to-right; focus on the method description and SQL effect, while treating `ColumnBuilder<...>` and nested generic return types as compiler metadata rather than syntax to memorize. |
| 2026-09-10 | Dialect/import choice clarified | The database choice determines the Drizzle core: this project uses PostgreSQL, so `pgTable` and all column builders (`uuid`, `varchar`, `text`, `timestamp`) must come from `drizzle-orm/pg-core`; `mysql-core` suggestions are for a different database. |
| 2026-09-10 | Requirement-to-syntax workflow clarified | Before typing Drizzle syntax, derive a small column contract (type, requiredness, uniqueness, default, relation, and ownership) from the ERD; then choose the PostgreSQL builder, constraints, and defaults that encode those facts. |
| 2026-09-10 | Schema thinking guide added | Added a standalone checkpoint explaining constraints, defaults, PostgreSQL sequences, requirement-to-syntax mapping, schema workflow, pitfalls, and retrieval exercises without implementing the application schema. |
| 2026-09-10 | First learner schema draft created | Learner created `src/database/schema.ts` with both tables; review will check dialect, exact DB column names, timestamp options, and update/default behavior before migration. |
| 2026-09-10 | First schema draft reviewed | TypeScript build passes, but review found missing `withTimezone` on timestamps, a `createdt_at` typo, `threads.content` using `varchar` instead of `text`, missing `updatedAt` insert default, and Prettier warnings; no migration yet. |
| 2026-09-10 | Timestamp default behavior clarified | `defaultNow()` runs as an insert fallback; `created_at` and `updated_at` may start equal, while later updates must explicitly change only `updated_at` (or use a deliberate runtime/DB trigger alternative). |
| 2026-09-10 | Schema draft aligned with ERD | Latest learner draft has the required PostgreSQL types, timezone-aware timestamps, corrected column names, cascade FK, and initial `updatedAt` default; only formatting and later public-ID generation remain before migration configuration. |
| 2026-09-11 | Drizzle config and dotenv added | Added the root `drizzle.config.ts` and `dotenv` devDependency so Drizzle Kit can read `DATABASE_URL`; the config is excluded from the Nest `src` build. |
| 2026-09-11 | Dependency-warning triage completed | Kept pnpm 10 and the current dependency set for reproducibility; pnpm v10's blocked install scripts, transitive deprecations, and the ESLint major-update notice do not require a blind upgrade. Build and Jest both pass. |
| 2026-09-11 | ESLint major upgrade verified | Direct devDependencies moved to ESLint `10.10.0` and `@eslint/js` `10.0.1`; Nest build and Jest still pass. A no-fix lint run exposed existing Prettier/schema formatting issues and type-safety findings to handle separately. |
| 2026-09-11 | Next step narrowed to database connectivity | The Drizzle config points at `src/database/schema.ts`; before generating a versioned migration, the project needs a local `.env` with `DATABASE_URL` and a reachable PostgreSQL database. |
| 2026-09-11 | PostgreSQL connectivity diagnosed | `.env` contains a `DATABASE_URL` for `localhost:5432/qa_forum`; the PostgreSQL 18 Windows service is installed but stopped, so the connection probe returned `ECONNREFUSED`. pgAdmin/DBeaver are clients, not the database server. |
| 2026-09-15 | PostgreSQL connection verified and first migration generated | The read-only connection reached `qa_forum`; `pnpm exec drizzle-kit generate` created `drizzle/0000_dry_diamondback.sql`. SQL review is still required before applying it with `migrate`; no database tables have been changed yet. |
| 2026-09-15 | Mentoring process corrected | The migration generation was executed by the mentor before the learner ran the command. Going forward, learning-critical CLI steps will be explained first and executed by the learner; the mentor will review the result. |
| 2026-09-15 | Unrequested migration generation undone | Removed only the migration files and empty `drizzle/` directory created by the mentor; the database was never changed. The learner will run `generate` after the command is explained. |
| 2026-09-15 | Migration naming clarified | Drizzle Kit's default suffix such as `dry_diamondback` is a generated label, while the numeric prefix tracks migration order. Use `--name=initial-schema` for a readable first migration; do not rename or rewrite migrations after they have been applied. |
| 2026-09-15 | Migration undo boundary clarified | An unapplied generated migration can be removed from the local `drizzle/` output; there is no normal `generate` undo command. An applied migration must be reversed with a new forward migration or deliberate database recovery, never by deleting its history. |
| 2026-09-15 | Learner generated named initial migration | Learner ran `pnpm exec drizzle-kit generate --name=initial-schema`; `drizzle/0000_initial-schema.sql` was created and reviewed without applying it to PostgreSQL. |
| 2026-09-15 | Migration explain-back corrected | The learner located the FK line correctly; clarified that `CASCADE` deletes referencing `threads` rows, not the FK constraint, and that `DEFAULT now()` does not auto-update `updated_at`. Keeping `users.created_at` only is correct until user-edit behavior requires `users.updated_at`. |
| 2026-09-15 | FK and timestamp mental models expanded | A foreign-key constraint is a persistent database rule; `ON DELETE CASCADE` removes referencing child rows while the rule remains. `DEFAULT now()` is an insert fallback, not an update trigger; `users.updated_at` is intentionally deferred until user-edit behavior exists. |
| 2026-09-15 | Mistake journal added | Recorded the learner's initial misunderstandings about the FK constraint versus cascading child rows and about `DEFAULT now()` versus automatic update behavior, together with the corrected mental model and retrieval scenario. |
| 2026-09-15 | Generate versus rollback clarified | `generate` has no undo command because it only writes local migration artifacts; deleting an unapplied migration folder is sufficient. An applied migration is reversed with a deliberate forward/reverse SQL change, not by blindly using `drop`. |
| 2026-09-15 | PostgreSQL database name issue resolved | An earlier connection attempt reported that `qa_forum` did not exist; after the learner created it on the configured PostgreSQL 18 server, the read-only connection now succeeds. |
| 2026-09-15 | Migration application prepared | Reviewed the generated SQL and confirmed the next learner-run step: apply `0000_initial-schema.sql` with `drizzle-kit migrate`; no tables have been created yet. |
| 2026-09-15 | Initial migration applied | Learner ran `pnpm exec drizzle-kit migrate`; Drizzle applied the migration successfully to `qa_forum`. Database verification is next; no application data has been inserted. |
| 2026-09-15 | Database structure verified | pgAdmin shows the `qa_forum` database with `users` and `threads`; the `threads.user_id` foreign key points to `users.id` and reports `ON DELETE CASCADE` / `ON UPDATE NO ACTION`. |
| 2026-09-15 | Next step narrowed to NestJS runtime configuration | `drizzle.config.ts` loads `.env` for Drizzle Kit, but the NestJS process needs the official `@nestjs/config` module before a runtime Drizzle provider is added. |
| 2026-09-15 | CLI/runtime environment boundary clarified | Direct `dotenv` remains for the Drizzle CLI config; `@nestjs/config` uses dotenv internally for NestJS runtime configuration and exposes `ConfigService`. The two dependencies serve different processes, so keeping both is intentional. |
| 2026-09-15 | Environment configuration mental model explained | Distinguished `.env`, the `dotenv` loader, Drizzle Kit's separate CLI process, and NestJS's `ConfigModule`/`ConfigService`; the learner can now reason why both packages may be present without treating them as duplicate application logic. |
| 2026-09-15 | NestJS configuration package installed | Learner ran `pnpm add @nestjs/config`; version `12.0.0` was added to runtime dependencies. Registration in `AppModule` is the next guided change. |
| 2026-09-15 | `ConfigModule.forRoot` and `isGlobal` explained | Distinguished TypeScript imports from Nest module registration; clarified that `forRoot()` loads configuration and registers `ConfigService`, while `isGlobal` only removes repeated per-module imports and does not create the database connection. |
| 2026-09-16 | Configuration retrieval check | Learner correctly identified the repeated-import cost of omitting `isGlobal`; refined the first answer: NestJS can still start, but without registering `ConfigModule`, the runtime `.env` loading and `ConfigService` setup do not occur. |
| 2026-09-16 | `ConfigModule` registered and build verified | Learner updated `src/app.module.ts` and ran `pnpm run build` successfully. Runtime database connectivity has not yet been tested; the next step is a Drizzle provider. |
| 2026-09-16 | Database provider concept introduced | Learner correctly separated provider work from migration work; clarified that the provider is a new runtime factory for one injectable Drizzle client, while migrations remain responsible for database structure. |
| 2026-09-16 | Accelerated provider implementation selected | Learner requested faster task completion; the next bounded implementation is the minimal custom NestJS provider using `ConfigService`, `pg`, and Drizzle, followed by a build/runtime smoke check. |
| 2026-09-16 | Provider wiring task specified | The learner will create `database.provider.ts`, wrap it in `DatabaseModule`, import that module from `AppModule`, and run a build; this stage wires runtime access only and does not rerun migrations. |
| 2026-09-16 | CLI generation versus custom provider clarified | Nest CLI can scaffold generic module/class files, but the Drizzle factory provider still needs manual project-specific configuration; avoiding a generated spec/class is the leanest path for this database adapter. |
| 2026-09-16 | Database module scaffold generated | Learner ran `pnpm exec nest g module database`; Nest CLI created only the module and added its import to `AppModule` because generators create only the explicitly requested Nest building block. A provider scaffold can be generated separately, then customized for Drizzle. |
| 2026-09-16 | Exact provider generator command verified | A dry run confirmed `pnpm exec nest g provider database/database.provider --flat --no-spec` creates `src/database/database.provider.ts` and updates `src/database/database.module.ts`; the generated provider body remains generic and must be customized for Drizzle. |
| 2026-09-16 | Educational comments approved for database wiring | Short comments may be added to the provider/module to explain roles and rationale while learning; comments should not restate obvious syntax or contain secrets, and can be reduced later when the mental model is established. |
| 2026-09-16 | Database module scaffolded with Nest CLI | Learner ran `pnpm exec nest g module database`; the CLI created `src/database/database.module.ts` and added its import to `AppModule`. The module is currently empty by design; the custom Drizzle provider is next. |
| 2026-09-16 | Custom Drizzle provider/module implemented and build verified | Learner replaced the generic provider scaffold with the `ConfigService`/`pg`/Drizzle factory, registered and exported it from `DatabaseModule`, and confirmed `pnpm run build` passes. A runtime bootstrap/query check remains. |
| 2026-09-16 | Nest watch output/cache issue diagnosed | Watch compilation reported zero errors but `node` could not find `dist/main`; a forced non-incremental TypeScript emit created `dist/main.js`, confirming the interaction between `deleteOutDir: true` and the stale incremental build-info cache. The fix is to remove the unnecessary incremental setting for this small project and clear the generated cache. |
| 2026-09-16 | Incremental-cache diagnosis independently verified | TypeScript's incremental emitter tracks affected source/options rather than checking whether emitted files still exist. This confirms that deleting `dist` while retaining `tsconfig.build.tsbuildinfo` can produce the observed missing `dist/main.js`; removing the optimization is the correct minimal fix here. |
| 2026-09-16 | NestJS runtime bootstrap verified | Learner removed the active incremental setting/cache and confirmed `pnpm run start:dev` now starts successfully. The `incremental` line is currently commented and should be removed entirely as routine cleanup; a real Drizzle query is the next verification. |
| 2026-09-16 | Startup smoke query skipped by scope decision | The learner emphasized fast completion without overengineering. Since migrations, pgAdmin, and NestJS boot already provide sufficient evidence, no startup `SELECT 1`, temporary health endpoint, or extra infrastructure will be added. Work now moves to required registration/authentication behavior. |
| 2026-09-11 | PostgreSQL readiness checked | A local PostgreSQL 18 Windows service exists but is stopped; `psql` is not on PATH, Docker is available, and `.env` exists without exposing its contents. The database itself is not yet verified, so no migration was run. |

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
those commits to the configured remote. Before the initial commit, `.gitignore`
was added for `node_modules/`, build/test output, TypeScript build info, logs, and
environment secrets. The initial project snapshot was reviewed, committed as
`chore: initialize Q&A forum API`, and pushed with an upstream branch on
`origin/codex/docs-database-readme`.

The initial snapshot was clean when it was pushed. This progress note is now a
small local documentation change awaiting the next focused commit. Future
changes should stay small and use a focused Conventional Commit subject such as
`docs: document database design`.

## Diagnosis type bcrypt (2026-09-16)

Editor dengan tepat melaporkan TS7016 karena package bcrypt runtime yang
terpasang tidak menyertakan declaration TypeScript yang dibutuhkan project ini.
Ditemukan type `require()` manual sementara di `AuthService`; itulah alasan
build dapat lolos, tetapi bukan solusi yang perlu dipertahankan. Pasang
`@types/bcrypt` sebagai dependency development dan kembalikan import bertipe
`import * as bcrypt from 'bcrypt'`.

Pemeriksaan lanjutan berhasil: `@types/bcrypt@6.0.0` berada di devDependencies
dan `AuthService` sudah kembali memakai `import * as bcrypt from 'bcrypt'`.
Workaround `require()` manual telah hilang; build berikutnya akan memverifikasi
seluruh integrasi bertipe tersebut.

Build sesudah pemasangan type bcrypt dinyatakan lulus oleh learner. Tahap
berikutnya adalah controller register minimal: `@Body()` menerima `RegisterDto`
yang sudah melalui ValidationPipe dan meneruskannya ke `AuthService.register()`.
Controller tidak meng-hash password atau menjalankan query database sendiri.

## Tahap hashing password (2026-09-16)

Setelah DTO dan prefix route siap, langkah register berikutnya adalah memasang
`bcrypt`. AuthService akan memakai API asynchronous untuk membuat hash saat
register dan `compare` saat login; password asli maupun salt terpisah tidak
disimpan. Catatan validasi/register telah ditambah dengan konsep ini.

`bcrypt@6.0.0` kini terpasang sebagai dependency runtime. Sebelum
`AuthService` dapat memasukkan user, `AuthModule` harus mengimpor
`DatabaseModule` secara eksplisit: module yang sama-sama diimpor oleh
`AppModule` tidak otomatis saling membagikan provider yang diekspornya. Ini
membuat dependency database tetap terlihat pada batas fitur.

## DTO strict-initialization diagnostic (2026-09-16)

The first `RegisterDto` build exposed TS2564 on all required DTO fields. This is
the expected TypeScript strict-property-initialization check: NestJS assigns DTO
values from the request at runtime, not in a constructor. The correct DTO
convention is a definite-assignment assertion (`field!: string`), not an
optional property (`field?: string`). The Indonesian validation note records
this distinction.

## Keputusan prefix route API (2026-09-16)

Challenge mengharuskan route diawali `/api`. Controller fitur tetap fokus pada
path lokalnya (`@Controller('auth')`), sedangkan prefix global `api` diatur satu
kali di `main.ts`. Dengan begitu, method controller `@Post('register')` menjadi
`/api/auth/register`, dan controller user/thread berikutnya memperoleh prefix
yang sama tanpa menulis `api/` berulang kali pada setiap decorator.

## Public-ID migration review (2026-09-16)

The generated `add-public-id-generators` migration was reviewed before
application. It creates only `users_public_id_seq` and
`threads_public_id_seq`, then adds the expected `U`/`T` formatting defaults to
the existing `public_id` columns. No unintended table, data, relation, or
constraint change appears in the SQL. It is approved for `drizzle-kit migrate`.

The migration was applied successfully to `qa_forum`. Both the TypeScript
schema and live PostgreSQL schema now include database-owned readable public-ID
generation. The next feature boundary is `AuthModule`, responsible only for the
challenge's registration and login endpoints; user-profile retrieval and thread
CRUD remain separate later features.

`AuthModule` will also own the challenge's authentication flow: registration
creates a user and hashes the password; login verifies that hash and issues a
JWT; a later JWT strategy/guard protects thread routes. These are one coherent
feature boundary, but will be implemented incrementally rather than all at
once.

The learner scaffolded `AuthModule`, `AuthController`, and `AuthService` with
the Nest CLI and skipped unnecessary spec-file boilerplate. Nest updated
`AppModule` and `AuthModule` registrations automatically. A build verification
is the remaining mechanical check before defining the registration contract.

The Auth scaffold passed `pnpm run build`. Before writing a controller or
database query, the next learning-critical decision is the register API
contract: client input must be only `username`, `email`, and plaintext
`password`; server-created/internal fields (`id`, `public_id`, timestamps, and
especially `password_hash`) are never accepted from or returned to the client.

Registration-response retrieval: the learner correctly identified the sensitive
nature of `password_hash`. The fuller rule is least exposure: TLS protects data
in transit, but a client has no legitimate need for a stored password hash and
leaking one still enables offline password-guessing attacks. The next mechanical
step is installing NestJS's standard DTO-validation dependencies.

`class-validator@0.15.1` and `class-transformer@0.5.1` were installed
successfully. Added `validation-and-register-contract.md` as a focused reference
covering DTO ownership, ValidationPipe behavior, the safe registration contract,
and password-hash exposure. Next: register a global ValidationPipe in `main.ts`.

The learner registered the global ValidationPipe and the project build passed.
The validation/register learning note has been translated fully to Indonesian as
requested. Next: create the concrete `RegisterDto` with its input rules.

Nest CLI generated the DTO class successfully but interpreted `register.dto` as
a directory name, producing `src/auth/dto/register.dto/register.dto.ts`. Before
editing, move that exact file to the intended conventional path
`src/auth/dto/register.dto.ts` and remove the now-empty generated directory.

## Public-ID generator prerequisite (2026-09-16)

`users.id` already receives an internal UUID through the schema default. In
contrast, `users.public_id` is `NOT NULL` and currently has no default, so an
insert that omits it would fail. Before implementing registration, PostgreSQL
should own the next readable identifiers: a user sequence formatted as `U001`,
`U002`, ... and a thread sequence formatted as `T001`, `T002`, .... This keeps
the request payload free of server-owned identifiers and avoids collisions from
application-side `count + 1` logic. It needs only a Drizzle schema update and
one migration—no package, endpoint, counter table, or startup query.

The generator still runs as a consequence of a `POST /api/auth/register` or
thread-creation request: NestJS performs an `INSERT` without a client-provided
`public_id`, then PostgreSQL evaluates that column's default during the insert.
The API input should not accept a server-owned ID; the completed entity returned
by the API may include it. For this sequential `U...`/`T...` requirement, a
database sequence is the lean concurrency-safe owner. Application-side ID
generation is a valid alternative for non-sequential IDs (for example UUIDs or
random opaque strings), but is not the selected design here.

The learner correctly identified that neither the internal `id` nor the
server-owned `public_id` belongs in the registration request body. The next
active step is to encode those database defaults in `schema.ts`, then verify the
TypeScript build before generating the follow-up migration.

Review confirmed that the learner has now added both exported sequence
declarations and both SQL-backed `publicId` defaults correctly. Only mechanical
formatting and a build verification remain before reviewing the generated
migration.

The schema formatting/build verification passed. The next narrow action is to
generate (but not yet apply) the migration that creates the two sequences and
sets the two column defaults, then inspect that generated SQL together.

### Migration history rule (2026-09-16)

The initial migration has already been applied to `qa_forum`, so it is now a
historical record rather than a draft. Empty application tables do not change
that fact: Drizzle records applied migrations and will not rerun an edited old
file automatically. The lean safe path is an additive second migration. Editing
the old migration is acceptable only before it has been applied anywhere, or
when deliberately resetting a disposable local database and its migration
history; neither reset is needed here.

## Latest timeline entry

| Date | Milestone | Status/reason |
|---|---|---|
| 2026-09-16 | Public-ID generation prepared | Registration needs a database default for its required readable `public_id`; next is a guided sequence/default migration. |
