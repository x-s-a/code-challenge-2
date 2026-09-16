# Panduan Berpikir dan Menulis `schema.ts`

Updated: 2026-09-15

Catatan ini menjelaskan cara menerjemahkan desain database menjadi schema Drizzle.
Tujuannya bukan menghafal semua syntax, tetapi memahami mengapa setiap builder,
constraint, dan default dipilih.

Konteks project tetap berasal dari [`challenge-2.md`](../../challenge-2.md),
desain DBML di [`docs/database-schema.dbml`](../../docs/database-schema.dbml), dan
ERD di [`docs/assets/database-erd.png`](../../docs/assets/database-erd.png).

## 1. Mental model utama

`schema.ts` adalah blueprint database dalam TypeScript. Ia menjelaskan kepada
Drizzle dan Drizzle Kit:

- tabel apa yang ada;
- kolom apa yang dimiliki setiap tabel;
- tipe data setiap kolom;
- aturan integritas data;
- nilai otomatis yang boleh dibuat database;
- hubungan foreign key antar tabel.

`schema.ts` bukan:

- data dummy JSON;
- migration SQL yang sudah dijalankan;
- DTO untuk memvalidasi HTTP request;
- service yang berisi business logic.

Alur besarnya:

```text
requirement / ERD
  → kontrak setiap kolom
  → pilih dialect database
  → pilih builder Drizzle
  → tambahkan constraint dan default
  → generate migration SQL
  → verifikasi dengan build, migration, dan test
```

Karena project memakai PostgreSQL, builder schema berasal dari
`drizzle-orm/pg-core`. Jangan mencampur builder `mysql-core` dengan `pg-core`.

## 2. Pola umum syntax

Pola yang perlu dikenali:

```text
namaPropertyTypeScript: builder('namaKolomDatabase', opsi)
  .constraint()
  .default();
```

Contoh fragmen:

```ts
publicId: varchar('public_id', { length: 20 }).notNull().unique(),
```

Cara membacanya:

1. `publicId` adalah nama property yang dipakai kode TypeScript.
2. `'public_id'` adalah nama kolom PostgreSQL.
3. `varchar(..., { length: 20 })` menetapkan tipe dan batas panjang.
4. `.notNull()` menetapkan bahwa kolom wajib memiliki nilai.
5. `.unique()` mencegah nilai duplikat.

Nama property dan nama kolom boleh sama, tetapi kita memilih camelCase untuk
TypeScript dan snake_case untuk PostgreSQL.

## 3. Function, method, dan module

Jangan menyebut semuanya sebagai method.

### Function call

Function dipanggil langsung dengan `()`:

```ts
pgTable('users', { ... });
uuid('id');
varchar('username', { length: 30 });
```

### Method call

Method dipanggil pada object setelah tanda titik:

```ts
uuid('id').primaryKey().defaultRandom();
```

Di sini:

- `uuid('id')` menghasilkan column builder;
- `.primaryKey()` adalah method builder;
- `.defaultRandom()` adalah method builder berikutnya;
- `()` berarti function atau method sedang dipanggil.

### Module atau dialect

`pg-core` dan `mysql-core` bukan method. Keduanya adalah lokasi import yang
mewakili dialect database:

| Database   | Table builder | Import                    |
| ---------- | ------------- | ------------------------- |
| PostgreSQL | `pgTable`     | `drizzle-orm/pg-core`     |
| MySQL      | `mysqlTable`  | `drizzle-orm/mysql-core`  |
| SQLite     | `sqliteTable` | `drizzle-orm/sqlite-core` |

Autocomplete dapat menampilkan semua dialect. Pilihan ditentukan oleh database
project, bukan oleh urutan item autocomplete.

## 4. Apa itu constraint?

Constraint adalah aturan yang dijaga database agar data tidak melanggar model.
Ini bukan sekadar komentar dan bukan hanya validasi di controller.

| Aturan data          | Drizzle            | Makna                                             |
| -------------------- | ------------------ | ------------------------------------------------- |
| Primary key          | `.primaryKey()`    | Identitas utama row; otomatis unique dan not-null |
| Wajib diisi          | `.notNull()`       | Insert/update tidak boleh menghasilkan NULL       |
| Tidak boleh duplikat | `.unique()`        | Database menolak nilai yang sama                  |
| Hubungan tabel       | `.references(...)` | Database menjaga target foreign key tetap valid   |

Constraint dipilih dari fakta pada ERD dan requirement. Jangan menambahnya hanya
karena method tersebut tersedia.

Contoh keputusan project:

- `users.id` adalah PK, jadi tidak perlu menulis `.unique()` lagi.
- `users.email` unique karena dua akun tidak boleh memakai email yang sama.
- `threads.user_id` tidak unique karena satu user boleh memiliki banyak thread.
- `threads.user_id` wajib dan mereferensikan `users.id`.

Validasi seperti format email, panjang password minimum, atau title tidak kosong
tetap dibuat di boundary API. Constraint database adalah lapisan perlindungan
terakhir, bukan pengganti validasi request.

## 5. Apa itu default?

`.default(...)` berarti:

> Jika statement `INSERT` tidak memberi nilai untuk kolom tersebut, database
> memakai nilai yang ditentukan sebagai default.

Contoh jenis default:

| Kebutuhan      | Bentuk Drizzle         | Arti                                                 |
| -------------- | ---------------------- | ---------------------------------------------------- |
| UUID acak      | `.defaultRandom()`     | Database membuat UUID ketika `id` tidak dikirim      |
| Waktu sekarang | `.defaultNow()`        | Database mengisi timestamp saat insert               |
| Nilai tetap    | `.default(42)`         | Database memakai literal `42` jika nilai dihilangkan |
| Ekspresi SQL   | `.default(sql\`...\`)` | Database menjalankan ekspresi SQL sebagai default    |

Default bukan berarti kolom selalu tidak boleh dikirim client. Jika ingin
mencegah client mengatur field tertentu, DTO/service harus mengabaikannya atau
menolaknya. Default hanya berlaku ketika nilai tidak diberikan ke `INSERT`.

### Default pada schema project

```ts
id: uuid('id').primaryKey().defaultRandom(),
```

Artinya database membuat UUID internal secara otomatis.

Untuk timestamp:

```ts
createdAt: timestamp('created_at', { withTimezone: true })
  .notNull()
  .defaultNow(),
```

`withTimezone: true` cocok dengan `TIMESTAMPTZ` pada desain PostgreSQL kita.

`updated_at` akan diisi saat insert dan diperbarui secara eksplisit oleh service
ketika thread benar-benar berubah. Untuk tahap belajar ini kita tidak memakai
trigger atau perilaku tersembunyi.

## 6. Apa itu sequence?

Sequence adalah object PostgreSQL yang menghasilkan nomor berikutnya secara
atomic, misalnya:

```text
1 → 2 → 3 → 4 → ...
```

Sequence berbeda dari `.default()`:

- sequence adalah sumber nomor berurutan;
- default adalah aturan kapan dan bagaimana nilai otomatis dipakai.

Keduanya dapat dikombinasikan. Sebuah kolom bisa memiliki default yang mengambil
nomor berikutnya dari sequence.

### Kenapa generator sequence diatur terpisah?

Pada tahap pertama `schema.ts`, kita mendefinisikan fakta kolomnya terlebih dahulu:

- `public_id` bertipe `VARCHAR(20)`;
- wajib diisi;
- unique.

Cara menghasilkan format `U001` atau `T001` membutuhkan keputusan tambahan:

1. sequence mana yang dipakai;
2. bagaimana prefix ditambahkan;
3. bagaimana angka dipadding;
4. apakah generator berada di database atau service.

Keputusan itu menyentuh migration dan alur insert, bukan hanya tipe kolom. Karena
itu tidak aman menulis default palsu seperti `U001` sekarang. Kita selesaikan
generator setelah bentuk schema dasar dan konfigurasi migration sudah dipahami.

Sequence boleh memiliki gap. Jika insert memakai nomor `U002` lalu gagal, nomor
tersebut tidak harus kembali dipakai. Syarat ID adalah unik dan stabil, bukan
tanpa celah.

## 7. Kontrak kolom sebelum menulis syntax

Sebelum mengetik setiap kolom, isi pertanyaan berikut:

```text
Nama database:
Nama property TypeScript:
Tipe database:
Boleh NULL:
Boleh duplikat:
Siapa yang membuat nilai:
Bisa berubah setelah insert:
Apakah punya foreign key:
```

### Kontrak `users`

| Kolom           | Tipe         | NULL? | Unique?       | Generator/owner                      | Relasi |
| --------------- | ------------ | ----- | ------------- | ------------------------------------ | ------ |
| `id`            | UUID         | Tidak | Ya, karena PK | Database, random UUID                | Tidak  |
| `public_id`     | VARCHAR(20)  | Tidak | Ya            | Generator sequence, dibahas terpisah | Tidak  |
| `username`      | VARCHAR(30)  | Tidak | Ya            | Request setelah validasi             | Tidak  |
| `email`         | VARCHAR(254) | Tidak | Ya            | Request setelah validasi             | Tidak  |
| `password_hash` | TEXT         | Tidak | Tidak         | Service setelah bcrypt               | Tidak  |
| `created_at`    | TIMESTAMPTZ  | Tidak | Tidak         | Database, waktu insert               | Tidak  |

### Kontrak `threads`

| Kolom        | Tipe        | NULL? | Unique?       | Generator/owner                           | Relasi           |
| ------------ | ----------- | ----- | ------------- | ----------------------------------------- | ---------------- |
| `id`         | UUID        | Tidak | Ya, karena PK | Database, random UUID                     | Tidak            |
| `public_id`  | VARCHAR(20) | Tidak | Ya            | Generator sequence, dibahas terpisah      | Tidak            |
| `user_id`    | UUID        | Tidak | Tidak         | Server dari user terautentikasi           | FK ke `users.id` |
| `title`      | VARCHAR(60) | Tidak | Tidak         | Request setelah validasi                  | Tidak            |
| `content`    | TEXT        | Tidak | Tidak         | Request setelah validasi                  | Tidak            |
| `created_at` | TIMESTAMPTZ | Tidak | Tidak         | Database, waktu insert                    | Tidak            |
| `updated_at` | TIMESTAMPTZ | Tidak | Tidak         | Database saat insert; service saat update | Tidak            |

## 8. Fragmen syntax penting

Contoh berikut adalah fragmen untuk membaca pola, bukan schema final yang harus
disalin seluruhnya.

### Primary key UUID

```ts
id: uuid('id').primaryKey().defaultRandom(),
```

Padanan konseptual SQL:

```sql
id UUID PRIMARY KEY NOT NULL DEFAULT gen_random_uuid()
```

### Kolom varchar wajib dan unique

```ts
publicId: varchar('public_id', { length: 20 }).notNull().unique(),
```

### Kolom text wajib

```ts
passwordHash: text('password_hash').notNull(),
```

### Timestamp PostgreSQL

```ts
createdAt: timestamp('created_at', { withTimezone: true })
  .notNull()
  .defaultNow(),
```

### Foreign key dengan cascade

```ts
userId: uuid('user_id')
  .notNull()
  .references(() => users.id, { onDelete: 'cascade' }),
```

`.references()` membuat aturan foreign key database. Helper `relations()` Drizzle
bersifat tambahan untuk kemudahan query; ia tidak menggantikan foreign key.

## 9. Urutan kerja di repository ini

1. Buat `src/database/schema.ts`.
2. Import builder dari `drizzle-orm/pg-core`.
3. Definisikan tabel `users` terlebih dahulu karena ia parent.
4. Cocokkan setiap kolom dengan kontrak di atas.
5. Jalankan `pnpm run build`.
6. Review hasil dan perbaiki mismatch sebelum lanjut.
7. Definisikan `threads`.
8. Tambahkan `threads.user_id → users.id` dengan `onDelete: 'cascade'`.
9. Jalankan build lagi.
10. Baru konfigurasi Drizzle Kit dan generate migration.

Jangan menjalankan migration sebelum schema dan koneksi database sudah dipahami.
Migration adalah perubahan nyata terhadap database; schema adalah sumber deklarasi
yang akan dibandingkan oleh Drizzle Kit.

## 10. Kesalahan umum yang harus dihindari

| Kesalahan                                    | Mengapa salah                                                         |
| -------------------------------------------- | --------------------------------------------------------------------- |
| Mencampur `mysql-core` dan `pg-core`         | Builder dibuat untuk dialect SQL yang berbeda                         |
| Menambah `.unique()` pada `threads.user_id`  | Mengubah one-to-many menjadi satu thread per user                     |
| Menambah `.unique()` pada PK                 | Redundan; PK sudah unique                                             |
| Memakai `.default('U001')`                   | Semua row baru akan mencoba memakai code yang sama                    |
| Memakai `COUNT + 1`                          | Request bersamaan dapat memilih angka sama                            |
| Menganggap `public_id` sebagai secret        | Code readable dapat ditebak; authorization tetap wajib                |
| Menaruh password asli di schema/DB           | Yang disimpan hanya `password_hash`                                   |
| Menganggap compile sukses berarti data benar | Build hanya memeriksa TypeScript, bukan semua aturan runtime/database |
| Menulis migration sebelum schema stabil      | Dapat menghasilkan perubahan DB yang keliru dan sulit dibalik         |

## 11. Cara membaca tooltip VS Code

Jika hover menampilkan sesuatu seperti:

```text
ColumnBuilder<...>.primaryKey(): IsPrimaryKey<NotNull<...>>
```

baca bagian berikut saja:

1. `(method)` → ini method;
2. `primaryKey()` → nama method dan tidak ada parameter;
3. deskripsi → efeknya terhadap schema;
4. generic panjang → metadata compiler, bukan syntax yang perlu diketik.

Jika autocomplete menampilkan beberapa `timestamp`, pilih yang modulnya
`drizzle-orm/pg-core` karena database project kita PostgreSQL.

## 12. Checklist sebelum meminta review

- [ ] Semua builder berasal dari `drizzle-orm/pg-core`.
- [ ] Nama property TypeScript konsisten camelCase.
- [ ] Nama kolom database konsisten dengan DBML snake_case.
- [ ] PK memakai UUID dan default random.
- [ ] PK tidak diberi `.unique()` tambahan.
- [ ] `public_id`, `username`, dan `email` wajib serta unique.
- [ ] `threads.user_id` wajib tetapi tidak unique.
- [ ] Foreign key menunjuk ke `users.id`, bukan `users.public_id`.
- [ ] Foreign key memakai `onDelete: 'cascade'`.
- [ ] Timestamp memakai timezone dan default waktu sekarang.
- [ ] Tidak ada default palsu untuk `U001` atau `T001`.
- [ ] `pnpm run build` dijalankan setelah perubahan.

## 13. Latihan retrieval

Sebelum lanjut ke migration, coba jelaskan tanpa melihat catatan:

1. Mengapa `threads.user_id` tidak boleh unique?
2. Apa perbedaan constraint dan validation?
3. Apa perbedaan sequence dan default?
4. Mengapa generator `public_id` tidak ditulis sebagai `.default('U001')`?
5. Mengapa `threads.user_id` mereferensikan `users.id`, bukan `users.public_id`?

Jika bisa menjawab lima pertanyaan itu, kamu sudah memahami keputusan schema,
bukan sekadar menyalin syntax.

## 14. Mental model: `CASCADE` dan `DEFAULT now()`

Dua konsep ini sering terlihat otomatis, tetapi keduanya bekerja pada hal yang
berbeda: `CASCADE` mengatur apa yang terjadi pada row terkait saat parent
dihapus, sedangkan `DEFAULT now()` hanya menyediakan nilai awal ketika row
dibuat.

### Foreign key adalah aturan, bukan row

Misalkan data sederhananya:

```text
users
id
U001
U002

threads
public_id | user_id
T001      | U001
T002      | U001
T003      | U002
```

`threads_user_id_users_id_fk` adalah nama constraint. Constraint adalah aturan
yang tetap tersimpan di database; ia bukan row `T001` atau `T002`.

Dengan:

```sql
ON DELETE CASCADE
```

ketika row user `U001` dihapus, PostgreSQL mencari semua row `threads` yang
memiliki `user_id = U001`, lalu menghapus row tersebut juga:

```text
users   → U002
threads → T003
```

Constraint `threads_user_id_users_id_fk` tetap ada. Ia masih diperlukan untuk
menjaga insert dan update berikutnya agar `threads.user_id` selalu menunjuk ke
user yang benar. Jadi `CASCADE` menghapus data child, bukan aturan relasinya.

### `DEFAULT now()` adalah fallback saat insert

Kolom berikut:

```sql
updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
```

berarti: ketika `INSERT` tidak memberikan nilai `updated_at`, PostgreSQL
menggunakan waktu sekarang.

```text
INSERT thread pada 10:00
created_at = 10:00
updated_at = 10:00
```

Jika kemudian query hanya mengubah title:

```sql
UPDATE threads
SET title = 'Judul baru'
WHERE id = ...;
```

PostgreSQL hanya mengubah `title`. Kolom `updated_at` yang tidak disebutkan
mempertahankan nilai lamanya. Database tidak otomatis menjalankan ulang default
untuk setiap update, karena default bukan trigger.

Pada project ini, service harus mengirim waktu baru secara eksplisit ketika
thread benar-benar diubah. Trigger database atau helper runtime seperti
`$onUpdate` adalah alternatif, tetapi sengaja belum dipakai agar alurnya mudah
dilihat dan diuji.

### Mengapa `users` belum memiliki `updated_at`?

Itu sesuai scope saat ini. User dibuat, login, dan profil publiknya dilihat;
belum ada endpoint untuk mengedit user. Karena belum ada perilaku update yang
perlu dilacak, `users.created_at` saja cukup.

`threads` memiliki `updated_at` karena requirement memang menyediakan endpoint
untuk mengubah title atau content. Jika kelak username, email, atau profil user
dapat diedit, `users.updated_at` dapat ditambahkan melalui migration baru.

Prinsipnya: tambahkan metadata berdasarkan perilaku bisnis, bukan sekadar agar
semua tabel terlihat simetris.

### Retrieval check

Jika user `U001` memiliki `T001` dan `T002`, lalu user itu dihapus:

- row `U001`, `T001`, dan `T002` hilang;
- row user lain dan thread milik user lain tetap ada;
- constraint foreign key tetap ada;
- timestamp `updated_at` tidak berubah hanya karena default pernah didefinisikan.

## 15. Mistake journal: FK/CASCADE dan timestamp

Catatan ini sengaja menyimpan kesalahan awal supaya proses berpikirnya bisa
diingat kembali, bukan hanya jawaban akhirnya.

### Jawaban awal yang keliru

- Untuk `CASCADE`, sempat dipahami bahwa ketika `users.id` dihapus, constraint
  `threads_user_id_users_id_fk` juga ikut dihapus.
- Untuk `updated_at`, sempat dijawab bahwa `DEFAULT now()` otomatis membuatnya
  berubah setiap kali thread diedit.

### Koreksi yang benar

`threads_user_id_users_id_fk` adalah aturan database, bukan row data. Ketika
user `U001` dihapus, PostgreSQL menghapus row child yang memiliki
`threads.user_id = U001`, misalnya `T001` dan `T002`. Constraint FK tetap ada
untuk menjaga insert dan update berikutnya.

```text
users   : U001, U002
threads : T001 → U001, T002 → U001, T003 → U002

hapus U001

users   : U002
threads : T003 → U002
constraint FK: tetap ada
```

`DEFAULT now()` juga bukan trigger. Ia hanya menjadi nilai fallback ketika
`INSERT` tidak memberikan nilai timestamp:

```text
insert thread pada 10:00
created_at = 10:00
updated_at = 10:00
```

Jika update hanya melakukan:

```sql
UPDATE threads
SET title = 'Judul baru'
WHERE id = ...;
```

maka PostgreSQL hanya mengubah `title`. `updated_at` tetap bernilai lama karena
kolom itu tidak ada di daftar `SET` dan database tidak menjalankan ulang default
secara otomatis. Service harus mengisi `updated_at` secara eksplisit; trigger
adalah alternatif yang lebih tersembunyi dan belum diperlukan untuk project ini.

### Mengapa `users.updated_at` belum ditambahkan?

Itu keputusan yang benar untuk scope sekarang. User dibuat, login, dan dilihat
profilnya, tetapi belum ada fitur edit user. `threads.updated_at` diperlukan
karena thread memang memiliki endpoint update. Jika nanti username, email, atau
profil user dapat diubah, tambahkan `users.updated_at` melalui migration baru.

### Check pemahaman

Jika `U001` memiliki `T001` dan `T002`, lalu `U001` dihapus:

- row `U001`, `T001`, dan `T002` hilang;
- row user lain dan thread user lain tetap ada;
- constraint `threads_user_id_users_id_fk` tetap hidup;
- `updated_at` tidak berubah hanya karena kolomnya memiliki `DEFAULT now()`.

## Referensi resmi

- [Drizzle PostgreSQL schema declaration](https://orm.drizzle.team/docs/sql-schema-declaration)
- [Drizzle PostgreSQL column types](https://orm.drizzle.team/docs/column-types/pg)
- [Drizzle PostgreSQL indexes and constraints](https://orm.drizzle.team/docs/indexes-constraints)
- [Drizzle PostgreSQL migrations](https://orm.drizzle.team/docs/migrations)
