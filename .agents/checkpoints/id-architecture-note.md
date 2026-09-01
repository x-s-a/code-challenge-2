# Approach Note: Internal ID + Public Identifier

Updated: 2026-08-26

Catatan ini menjelaskan mengapa kita memisahkan ID internal database dari kode yang terlihat oleh client API.

## 1. Keputusan desain

Untuk challenge Q&A Forum, kita akan mempraktikkan pola:

- setiap row memiliki **internal ID** yang dipakai database;
- setiap row memiliki **public ID** yang boleh dipakai client API;
- relasi foreign key memakai internal ID, bukan public ID;
- nilai public ID memakai prefix agar mudah dibaca: `U001` untuk user dan `T001` untuk thread.

Contoh bentuk tabel:

```text
users
- id           UUID primary key        (internal)
- public_id    VARCHAR unique          (contoh: U001)
- username     VARCHAR unique
- email        VARCHAR unique
- password_hash
- created_at

threads
- id           UUID primary key        (internal)
- public_id    VARCHAR unique          (contoh: T001)
- user_id      UUID foreign key        → users.id
- title
- content
- created_at
- updated_at
```

Nama `public_id` menandai identifier yang aman dipakai di batas API. Nilainya
berbentuk readable code seperti `U001`/`T001`. Jika challenge meminta response
dengan field `id`, DTO API boleh memetakan `public_id` menjadi `id` pada response,
tetapi relasi internal tetap memakai `id` UUID.

## 2. Mental model

### Internal ID

Internal ID adalah identitas teknis row. Ia digunakan untuk:

- primary key;
- foreign key;
- join antar tabel;
- update/delete di dalam service;
- index dan query database.

Internal ID sebaiknya stabil dan tidak bergantung pada format yang terlihat oleh manusia.

### Public ID (nilai berbentuk code)

Public ID adalah identitas eksternal yang digunakan pada batas API:

```text
GET /api/users/U001
GET /api/threads/T001
```

Public ID berguna untuk URL, dokumentasi, support, dan komunikasi manusia. Ia
bukan password dan bukan secret.

### Mengapa foreign key memakai internal ID?

Jika format public code berubah dari `T001` menjadi `THREAD-001`, relasi database tidak perlu ikut berubah. Query internal tetap:

```text
threads.user_id → users.id
```

API mencari thread berdasarkan `threads.public_id`, kemudian melakukan join ke user berdasarkan UUID internal.

## 3. Cara membuat ID secara aman

### Internal UUID

Internal UUID dibuat oleh database atau library UUID yang tepercaya. UUID tidak memerlukan counter yang dikelola aplikasi dan kecil kemungkinan collision.

### Public ID dengan sequence

Angka public code sebaiknya dibuat oleh PostgreSQL sequence:

```text
user sequence:   1 → U001, 2 → U002, 3 → U003
thread sequence: 1 → T001, 2 → T002, 3 → T003
```

Sequence aman untuk request bersamaan karena database memberi nomor berikutnya secara atomic.

Jangan membuat ID dengan:

```text
COUNT(*) + 1
MAX(id) + 1
angka yang dikirim client
Math.random() sebagai jaminan keunikan
```

Dua request dapat membaca count atau max yang sama dan memilih nomor yang sama.

### Transaction bukan pengganti sequence

Transaction berguna ketika beberapa operasi harus berhasil atau gagal bersama-sama. Contoh: membuat user dan data profile dalam satu aksi.

Transaction saja tidak otomatis membuat `COUNT(*) + 1` aman. Cara itu membutuhkan locking atau isolation khusus dan retry. Sequence adalah alat yang memang dirancang untuk menghasilkan nomor unik secara concurrent-safe.

## 4. Apakah sequence boleh memiliki gap?

Boleh. Misalnya:

```text
U001 berhasil
U002 insert gagal dan rollback
U003 berhasil
```

Nomor `U002` tidak dipakai. Ini normal karena sequence tidak harus rollback bersama transaction.

Untuk ID, syarat utamanya adalah **unik dan stabil**, bukan tanpa celah. Nomor tanpa celah biasanya hanya diperlukan untuk kebutuhan legal seperti nomor invoice, dan membutuhkan desain numbering yang berbeda.

## 5. Alur request utama

### Membuat user

```text
request register
  → validasi username/email/password
  → database membuat internal UUID
  → sequence membuat public_id U...
  → simpan password_hash, bukan password asli
  → response mengembalikan public code, bukan password
```

### Membuat thread

```text
request POST /threads
  → JWT dibaca
  → JWT menghasilkan internal users.id
  → database membuat internal threads.id
  → sequence membuat public_id T...
  → simpan threads.user_id = users.id
```

Client tidak boleh bebas mengirim `user_id` untuk menentukan pemilik thread. Pemilik berasal dari user yang sudah diautentikasi.

### Membaca thread melalui API

```text
GET /api/threads/T001
  → cari threads.public_id = T001
  → ambil threads.user_id
  → join ke users.id
  → response data publik thread dan user
```

### Update atau delete

```text
URL public code → cari row → bandingkan owner internal ID dari JWT → izinkan atau 403
```

Public code hanya menemukan row. Ia tidak membuktikan bahwa requester adalah pemiliknya.

## 6. Kelebihan pendekatan ini

1. **Relasi lebih stabil**
   Foreign key tidak bergantung pada format kode yang terlihat client.

2. **API lebih mudah dibaca**
   `T001` lebih komunikatif daripada UUID panjang ketika membaca dokumentasi atau log.

3. **Format eksternal bisa berubah**
   Prefix atau padding dapat diubah tanpa migrasi semua foreign key.

4. **Database tetap punya key teknis yang baik**
   UUID internal cocok untuk join dan tidak mengungkap urutan insert.

5. **Batas internal-eksternal jelas**
   Service memakai internal ID; controller/DTO menangani public code.

6. **Latihan production design**
   Kita belajar surrogate key, alternate unique key, foreign key, sequence, dan authorization secara nyata.

## 7. Kekurangan dan trade-off

1. **Kolom bertambah**
   Setiap tabel memiliki dua identifier.

2. **Mapping bertambah**
    Service harus membedakan `id` internal dan `public_id`.

3. **Generator lebih kompleks**
   Kita membutuhkan sequence dan format prefix.

4. **Public code tetap bisa ditebak**
   `T001` lalu `T002` dapat dienumerasi. Jangan menganggap public code sebagai security boundary.

5. **UUID lebih besar daripada integer**
   Index dan foreign key UUID memerlukan lebih banyak ruang daripada integer, meskipun untuk challenge ini dampaknya kecil.

6. **Sequence memiliki gap**
   Nomor yang gagal dipakai tidak otomatis kembali.

7. **Lebih banyak test**
   Kita harus menguji lookup public code, mapping response, collision, dan ownership.

Untuk aplikasi kecil yang tidak membutuhkan kode manusia, UUID tunggal akan lebih sederhana. Dua identifier dipilih di sini karena kita sengaja berlatih pola API production dan ingin mempertahankan format contoh challenge.

## 8. Skenario penting

### Skenario A — dua user dibuat bersamaan

Sequence user harus menghasilkan dua public code berbeda. Database unique constraint tetap menjadi perlindungan terakhir.

### Skenario B — dua user memakai email sama

Validasi API boleh memberi pesan ramah, tetapi database `UNIQUE(email)` harus tetap menolak duplikasi. Untuk API production, `409 Conflict` sering lebih tepat; challenge dapat mendokumentasikan pilihan status yang dipakai.

### Skenario C — user mengirim `public_id` sendiri

Jangan mempercayai nilai itu. Server harus mengabaikannya atau menolaknya, lalu membuat code sendiri.

### Skenario D — format code berubah

Mengubah `T001` menjadi `THREAD-001` hanya memengaruhi generator dan lookup public code. `threads.user_id` tetap memakai internal UUID.

### Skenario E — data di-import atau di-seed

Jangan asal memasukkan `U001` lalu berharap sequence otomatis tahu posisi terakhir. Setelah import manual, sequence harus diselaraskan atau import harus memakai generator database.

### Skenario F — user dihapus

Keputusan kita: gunakan `CASCADE`, sehingga semua thread milik user ikut
terhapus. Ini mencegah orphaned threads dan sesuai dengan aturan yang dipilih
untuk challenge, tetapi berarti operasi delete user dapat menghapus banyak data.
Endpoint-nya harus terlindungi authorization yang tepat, dan perilaku cascade
harus diuji secara eksplisit.

### Skenario G — public code mencapai `U999`

Kita harus menentukan apakah padding hanya kosmetik atau memiliki batas tetap. Rekomendasi: padding minimum tiga digit, tetapi izinkan `U1000` daripada gagal karena batas buatan.

### Skenario H — perbedaan huruf besar-kecil

Tetapkan aturan satu kali. Rekomendasi: generator selalu menghasilkan huruf besar dan lookup menormalkan input atau menggunakan aturan case-insensitive yang jelas.

## 9. Edge case dan aturan pencegahan

| Edge case | Pencegahan |
|---|---|
| Duplicate internal UUID | primary key database |
| Duplicate public code | sequence + `UNIQUE` |
| Dua request bersamaan | sequence, bukan `COUNT + 1` |
| Client memilih owner | ambil owner dari JWT |
| Code tidak ditemukan | response `404` |
| Code milik user lain | response `403` untuk operasi protected |
| Sequence gap | terima sebagai normal; jangan mengandalkan nomor tanpa celah |
| Code terlalu panjang | tetapkan ukuran kolom dan aturan overflow |
| Case tidak konsisten | normalisasi uppercase |
| Import manual | sinkronkan sequence setelah import |
| User delete dengan thread | `ON DELETE CASCADE`; uji penghapusan seluruh thread terkait |
| Soft-deleted code dipakai ulang | jangan reuse public code; pertahankan uniqueness |
| Public code dianggap secret | tetap lakukan authentication dan authorization |
| Lookup lambat | beri unique index pada `public_id` dan index pada `threads.user_id` |

## 10. Security boundary

Public code adalah identifier, bukan authorization.

Seseorang yang mengetahui `T001` tetap tidak boleh:

- mengubah thread jika bukan creator;
- menghapus thread jika bukan creator;
- melihat field private user;
- memperoleh password hash atau token secret.

Authorization harus membandingkan:

```text
JWT subject/internal user ID == threads.user_id
```

Bukan sekadar membandingkan public code dari URL dengan input client.

## 11. Constraint dan validasi

### Database constraints

- `users.id` primary key;
- `users.public_id` unique dan not null;
- `threads.id` primary key;
- `threads.public_id` unique dan not null;
- `threads.user_id` not null dan foreign key ke `users.id`;
- `users.username` unique;
- `users.email` unique.

### API validation

- title/content tidak boleh kosong;
- email harus memiliki format valid;
- password memenuhi aturan minimum;
- public code pada create tidak berasal dari client;
- path parameter harus memiliki format code yang benar.

Validasi aplikasi memberi feedback. Constraint database menjaga kebenaran ketika ada race condition atau client yang melewati API normal.

## 12. Kapan pendekatan lain lebih tepat?

### UUID tunggal

Pilih ini jika:

- tidak ada kebutuhan code yang mudah dibaca;
- ingin schema paling sederhana;
- public URL boleh menggunakan UUID.

### Integer auto-increment tunggal

Pilih ini jika:

- aplikasi internal;
- efisiensi ukuran index lebih penting;
- enumeration ID bukan masalah.

### Public code sebagai primary key

Masih dapat digunakan untuk challenge kecil, tetapi membuat foreign key dan seluruh relasi bergantung pada format eksternal. Jika format berubah, dampaknya lebih besar.

### Internal UUID + public code

Ini pilihan kita karena menggabungkan relasi internal yang stabil dengan identifier API yang mudah dibaca.

## 13. Checklist implementasi nanti

- [ ] Pilih ukuran kolom `public_id`.
- [x] Tetapkan prefix `U` dan `T`.
- [x] Tetapkan aturan uppercase dan padding minimum; izinkan lebih dari tiga digit.
- [ ] Buat sequence database terpisah untuk user dan thread.
- [ ] Buat internal UUID primary key.
- [ ] Buat unique constraint untuk public code.
- [ ] Pastikan `threads.user_id` mengarah ke `users.id` internal.
- [ ] Buat unique index pada `public_id`.
- [ ] Buat index pada `threads.user_id`.
- [x] Tetapkan aturan ketika user dihapus: `ON DELETE CASCADE`.
- [ ] Pastikan client tidak dapat memilih owner thread.
- [ ] Uji dua insert bersamaan.
- [ ] Uji code gap setelah rollback.
- [ ] Uji 404 untuk code yang tidak ada.
- [ ] Uji 403 untuk user yang bukan pemilik.
- [ ] Dokumentasikan mapping public code pada Swagger.

## 14. Ringkasan satu kalimat

**Internal UUID menjaga relasi database tetap stabil; public code `U...`/`T...` membuat API mudah dibaca; sequence dan constraint database menjaga keunikan; authorization tetap menentukan siapa yang boleh melakukan apa.**

## 15. Retrieval check

Sebelum implementasi, pastikan bisa menjawab:

1. Mengapa `threads.user_id` mengarah ke `users.id` internal, bukan `users.public_id`?
2. Mengapa transaction saja tidak cukup untuk membuat `COUNT(*) + 1` aman?
3. Apakah gap pada public code berarti database rusak?
4. Apakah mengetahui `T001` memberi hak untuk menghapus thread?
