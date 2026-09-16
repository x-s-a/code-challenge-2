# Project Setup & CLI Notes — Q&A Forum API

## Stack yang kita pilih

| Layer             | Pilihan            | Status                                         |
| ----------------- | ------------------ | ---------------------------------------------- |
| Runtime           | Node.js            | Sudah ada                                      |
| Language          | TypeScript 6       | Sudah dipilih dan diverifikasi                 |
| Framework         | NestJS 11          | Sudah di-scaffold                              |
| Package manager   | pnpm               | Dipakai untuk project ini                      |
| Database          | PostgreSQL         | Pilihan database                               |
| ORM/query layer   | Drizzle ORM        | Sudah dipasang                                 |
| PostgreSQL driver | `pg`               | Sudah dipasang                                 |
| Migration CLI     | Drizzle Kit        | Sudah dipasang sebagai devDependency           |
| Testing           | Jest dan Supertest | Jest scaffold sudah ada; test feature menyusul |

Target berikutnya—JWT, bcrypt, validation, `.env` config, dan Swagger/OpenAPI—
ditambahkan saat fitur yang membutuhkannya mulai dibuat. Dependency yang belum
dibutuhkan tidak dipasang hanya untuk “persiapan”.

Catatan ini merangkum cara project dibuat, arti command yang dipakai, dan urutan
setup yang bisa diulang ketika mulai dari folder kosong. Konteks project tetap
berasal dari [`challenge-2.md`](../../challenge-2.md).

## Kondisi project saat ini

- NestJS sudah di-scaffold.
- Package manager yang dipakai adalah pnpm.
- TypeScript `6.0.3` sudah dipilih dan diverifikasi.
- PostgreSQL dan Drizzle sudah ditambahkan sebagai dependency.
- `drizzle-kit` dan `@types/pg` berada di devDependencies.
- ERD, DBML, dan README database sudah ada di folder `docs/`.
- Schema Drizzle belum ditulis; schema akan dibuat secara bertahap oleh learner.
- Initial Git commit sudah dipush ke branch `codex/docs-database-readme`.
- Panduan setup ini adalah referensi utama ketika lupa urutan atau arti command.

## Gambaran besar urutan setup

```text
prasyarat
  → scaffold NestJS
  → install dependency dengan pnpm
  → pilih/verifikasi TypeScript
  → install PostgreSQL + Drizzle
  → verifikasi build/test
  → desain database di docs/
  → tulis schema Drizzle
  → konfigurasi koneksi dan Drizzle Kit
  → generate/apply migration
```

Urutan ini sengaja memisahkan desain database, schema TypeScript, dan migration.
Migration tidak dibuat sebelum schema dan koneksi database dipahami.

## 1. Prasyarat

Periksa tool dasar:

```bash
node --version
pnpm --version
git --version
```

Node.js menjalankan aplikasi dan tool JavaScript. pnpm mengelola dependency.
Git menyimpan history perubahan project.

## 2. Membuat project NestJS

Jalankan scaffold hanya di folder kosong. Karena repository kita sudah memiliki
Git, command bootstrap yang cocok adalah:

```bash
nest new . --skip-git --package-manager pnpm --strict
```

Jika Nest CLI belum dipasang global, gunakan runner sementara:

```bash
pnpm dlx @nestjs/cli new . --skip-git --package-manager pnpm --strict
```

`nest new` membuat skeleton aplikasi dan file konfigurasi dasar. Bagian command
di atas berarti:

| Bagian                   | Arti                                                 |
| ------------------------ | ---------------------------------------------------- |
| `nest`                   | Program CLI NestJS                                   |
| `new`                    | Subcommand untuk membuat project                     |
| `.`                      | Positional argument: gunakan folder saat ini         |
| `--skip-git`             | Jangan membuat repository Git kedua di dalam project |
| `--package-manager pnpm` | Gunakan pnpm untuk dependency management             |
| `--strict`               | Aktifkan beberapa strict TypeScript checks           |

Kalau ingin memisahkan pembuatan file dan install dependency, tambahkan
`--skip-install`:

```bash
nest new . --skip-git --skip-install --package-manager pnpm --strict
pnpm install
```

`--skip-install` bukan kewajiban atau “best practice” universal. Itu hanya option
untuk memisahkan dua fase:

```text
1. scaffold file project
2. inspect package.json
3. install dependency dengan pnpm
```

Tanpa `--skip-install`, Nest dapat langsung memasang dependency. Untuk project
biasa itu lebih singkat; dengan flag tersebut kita mendapat kontrol lebih jelas
atas package manager dan lockfile.

Untuk project yang sudah ada, jangan menjalankan scaffold ulang. Cukup masuk ke
folder project dan gunakan `pnpm install`.

### File yang dibuat oleh scaffold

Kurang lebih struktur awalnya:

```text
src/
  app.controller.ts
  app.controller.spec.ts
  app.module.ts
  app.service.ts
  main.ts

test/
  app.e2e-spec.ts
  jest-e2e.json

package.json
tsconfig.json
tsconfig.build.json
nest-cli.json
eslint.config.mjs
.prettierrc
README.md
```

NestJS adalah framework utama. Kita tidak perlu memasang framework backend kedua.

## 3. Install dependency

Setelah scaffold selesai:

```bash
pnpm install
```

Command ini membaca `package.json` dan lockfile, lalu memasang dependency yang
sudah dideklarasikan. Ini berbeda dari `pnpm add`, yang menambahkan dependency
baru ke `package.json` sekaligus memasangnya.

Dependency runtime project:

```bash
pnpm add drizzle-orm pg
```

Dependency development/tooling:

```bash
pnpm add -D drizzle-kit @types/pg
```

- `drizzle-orm`: query builder/ORM yang dipakai oleh aplikasi.
- `pg`: driver runtime untuk membuka koneksi PostgreSQL dari Node.js.
- `drizzle-kit`: CLI untuk schema/migration, hanya diperlukan saat development
  atau deployment pipeline.
- `@types/pg`: informasi tipe TypeScript untuk package `pg`; tidak menjalankan
  koneksi database saat runtime.

## 4. TypeScript dan verifikasi awal

TypeScript project ini diset ke versi 6:

```bash
pnpm add -D typescript@^6.0.3
pnpm exec tsc -v
```

`pnpm exec` menjalankan binary lokal dari dependency project, sehingga tidak
perlu install TypeScript atau Jest secara global.

Jangan memakai versi compiler global sebagai bukti versi project. `npx tsc -v`
atau `tsc -v` dapat membaca binary dari tempat lain; yang penting adalah binary
lokal project:

```bash
pnpm exec tsc -v
pnpm list typescript --depth 0
```

Tanda caret pada versi dependency berarti rentang kompatibel dalam major version
yang sama. Misalnya `^6.0.3` berarti minimal `6.0.3`, tetapi tetap di bawah `7.0.0`.

### Penyesuaian TypeScript 6

Pada project ini, beberapa pengaturan penting adalah:

- `types: ["node"]` agar TypeScript mengenali API Node seperti `process.env`;
- `rootDir: "./"` di `tsconfig.json` karena konfigurasi dasar juga dipakai test;
- `rootDir: "./src"` di `tsconfig.build.json` agar build aplikasi hanya mengambil
  source utama dari `src`.

Dengan begitu, konfigurasi source/test dan konfigurasi build tidak tercampur.

Verifikasi skeleton:

```bash
pnpm run build
pnpm exec jest --runInBand
```

Perbedaan pemeriksaan:

- `build`: mengompilasi TypeScript menjadi JavaScript dan menemukan masalah
  tipe/konfigurasi compile;
- Jest: menjalankan test dan memeriksa perilaku aplikasi;
- ESLint: memeriksa pola/kualitas kode; script `pnpm run lint` project ini juga
  memakai `--fix`, jadi dapat mengubah file dan hasilnya perlu ditinjau.

Contoh perbedaan hasilnya:

- TypeScript dapat gagal di `build` ketika angka diharapkan tetapi string diberikan;
- function yang salah secara logika dapat tetap lolos `build`, tetapi gagal di
  Jest;
- variable yang tidak dipakai dapat ditandai ESLint walaupun compile dan behavior
  test tetap lolos.

## 5. Command project sehari-hari

```bash
pnpm run start:dev
pnpm run start
pnpm run build
pnpm exec jest --runInBand
pnpm test
pnpm run test:e2e
pnpm run test:cov
pnpm run start:prod
pnpm list --depth 0
```

| Command                 | Fungsi                                  | Kapan dipakai                                 |
| ----------------------- | --------------------------------------- | --------------------------------------------- |
| `pnpm install`          | Memasang dependency yang sudah tercatat | Setelah clone atau `package.json` berubah     |
| `pnpm add <package>`    | Menambah dependency runtime             | Saat aplikasi membutuhkan package baru        |
| `pnpm add -D <package>` | Menambah devDependency                  | Saat package hanya untuk build/test/migration |
| `pnpm exec <binary>`    | Menjalankan binary lokal                | Contoh: `pnpm exec jest` atau `pnpm exec tsc` |
| `pnpm run <script>`     | Menjalankan script dari `package.json`  | Contoh: `start:dev`, `build`, `test:e2e`      |
| `pnpm list`             | Melihat dependency/version terpasang    | Saat memeriksa environment                    |

### `--runInBand`

Pada command `pnpm exec jest --runInBand`, option milik Jest ini memaksa seluruh
test berjalan serial dalam satu process. Ini memudahkan debugging, mengurangi
penggunaan memory, dan mencegah benturan resource seperti port atau database.

Trade-off-nya: test suite besar dapat berjalan lebih lambat. Dengan satu test
suite kecil, option ini belum wajib; kita memakainya agar output dan prosesnya
mudah dibaca. Ketika test sudah independen dan banyak, `pnpm exec jest` dapat
memakai worker parallel bawaan Jest.

## 6. Desain database sebelum migration

Desain database disimpan sebagai artefak yang bisa dibaca manusia:

- ERD: [`docs/assets/database-erd.png`](../../docs/assets/database-erd.png)
- DBML: [`docs/database-schema.dbml`](../../docs/database-schema.dbml)
- Penjelasan desain: [`README.md`](../../README.md)

Modelnya terdiri dari `users` dan `threads` dengan relasi one-to-many. Keputusan
pentingnya adalah UUID internal, `public_id` eksternal, foreign key
`threads.user_id → users.id`, serta `ON DELETE CASCADE`.

Schema Drizzle nanti harus menerjemahkan keputusan tersebut. Jangan menyalin
dummy JSON sebagai database; JSON di challenge hanya contoh struktur response.

## 7. Environment dan database (langkah berikutnya)

Challenge mewajibkan konfigurasi seperti port, database connection, dan JWT
secret berada di environment variable. Jangan menaruh credential asli di Git.

Pola file yang akan dipakai nanti:

```text
.env.example  ← nama variable tanpa secret asli, boleh di-commit
.env          ← nilai lokal/secret, jangan di-commit
```

Setelah schema ditulis, barulah kita membuat konfigurasi Drizzle Kit dan memilih
cara koneksi PostgreSQL. Migration dirancang dari schema tersebut, bukan dari
gambar ERD secara langsung.

### Status feature pada checkpoint ini

Sudah ada:

- NestJS scaffold;
- pnpm dan TypeScript 6 lokal;
- penyesuaian `tsconfig` dan verifikasi build/Jest;
- `drizzle-orm`, `pg`, `drizzle-kit`, dan `@types/pg`;
- ERD, DBML, README database, dan Git history awal.

Belum dikerjakan pada alur manual:

- schema `users` dan `threads`;
- `drizzle.config.ts` dan koneksi PostgreSQL;
- `.env`/`DATABASE_URL`;
- migration;
- auth/JWT, bcrypt, validation, Swagger, dan CRUD threads.

Beberapa item di atas pernah dibuat dalam percobaan otomatis, tetapi sudah
di-rollback. Jangan menganggap file feature tersebut sudah ada.

## 8. Git hygiene saat setup

Sebelum staging, `.gitignore` harus mengabaikan:

```text
node_modules/
dist/
coverage/
*.tsbuildinfo
.env
.env.*
!.env.example
```

Workflow ringkas:

```bash
git status --short
git add -A
git diff --cached --check
git diff --cached --name-only
git commit -m "type: describe one logical change"
git push
```

Review staged file list sebelum commit. Jangan memakai `git push --force` sebagai
workflow normal, dan jangan memasukkan `node_modules`, build output, atau secret.

## Urutan setup jika mulai dari nol

Gunakan urutan ini untuk mengulang setup. Command scaffold hanya berlaku di folder
kosong; jangan menjalankannya ulang di repository aktif.

```text
[1] cek Node.js, pnpm, Git, dan Nest CLI
        ↓
[2] nest new . --skip-git --package-manager pnpm --strict
        ↓
[3] jika memilih pisahkan install: tambahkan --skip-install, lalu pnpm install
        ↓
[4] pilih/verifikasi TypeScript 6 dan sesuaikan tsconfig bila perlu
        ↓
[5] pnpm run build
        ↓
[6] pnpm exec jest --runInBand
        ↓
[7] pnpm add drizzle-orm pg
        ↓
[8] pnpm add -D drizzle-kit @types/pg
        ↓
[9] pnpm run build lagi
        ↓
[10] baru desain schema, koneksi database, dan migration
```

Lifecycle hariannya lebih pendek:

```text
pnpm install → tulis kode → lint/test/build → jalankan aplikasi
```

## Cheat sheet istilah CLI

Dalam command seperti `pnpm add -D drizzle-kit`:

- `pnpm`: program CLI utama;
- `add`: subcommand;
- `-D`: option/flag singkat untuk `--save-dev`;
- `drizzle-kit`: argument, yaitu package yang ingin ditambahkan.

Dalam `pnpm run start:dev`, `start:dev` adalah nama script yang didefinisikan di
`package.json`, bukan command Nest yang harus dihafal terpisah.

## Referensi resmi

- [NestJS CLI usage](https://docs.nestjs.com/cli/usages)
- [pnpm install](https://pnpm.io/cli/install)
- [pnpm add](https://pnpm.io/cli/add)
- [pnpm exec](https://pnpm.io/cli/exec)
- [Drizzle PostgreSQL column types](https://orm.drizzle.team/docs/column-types/pg)
