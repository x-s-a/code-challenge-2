# Validasi & Kontrak Register — Catatan Belajar

Diperbarui: 2026-09-16

## Mengapa validasi dilakukan di batas API?

Body request berasal dari luar aplikasi, sehingga tidak boleh langsung
dipercaya. **DTO** (*Data Transfer Object*) menjelaskan bentuk input yang boleh
masuk. Untuk registrasi, client hanya boleh mengirim:

- `username`
- `email`
- `password`

Validasi menolak data buruk *sebelum* controller/service mencoba memakainya.
Hasilnya adalah `400 Bad Request` yang jelas, bukan error database yang muncul
belakangan atau kegagalan runtime yang membingungkan.

## Package yang dipakai

- `class-validator`: decorator seperti `@IsEmail()` untuk menyatakan aturan.
- `class-transformer`: mendukung alur transformasi dan validasi DTO di NestJS.

Keduanya adalah dependency runtime karena API yang sedang berjalan mengeksekusi
logika validasinya; keduanya bukan sekadar tipe untuk editor TypeScript.

## ValidationPipe global

NestJS memiliki `ValidationPipe`: gerbang di antara request HTTP masuk dan
handler controller. Kita mendaftarkannya satu kali secara global di `main.ts`
agar semua DTO endpoint berikutnya mendapat perlindungan dasar yang sama.

Pengaturan yang dipakai:

- `whitelist: true` — hanya field yang dideklarasikan pada DTO yang diizinkan.
- `forbidNonWhitelisted: true` — field asing ditolak, bukan diam-diam diterima.
  Ini membuat kesalahan client terlihat jelas.
- `transform: true` — NestJS dapat mentransformasikan input sesuai metadata DTO
  saat diperlukan.

Pipe global tidak menciptakan aturan validasi sendiri. Setiap endpoint tetap
memerlukan class DTO konkret yang memiliki decorator aturan.

### Mengapa field DTO memakai `!`?

TypeScript pada project ini menjalankan pemeriksaan ketat untuk property class.
Ia melihat `username: string` dan bertanya: “di constructor, kapan nilai ini
diisi?” DTO tidak memiliki constructor yang mengisinya, karena NestJS akan
mengisi instance DTO dari HTTP request *setelah* object dibuat.

Karena itu kita menulis `username!: string` (dan seterusnya). Tanda `!` adalah
**definite assignment assertion**: janji kepada compiler bahwa framework akan
mengisi property tersebut sebelum dipakai oleh alur aplikasi. Ini bukan nilai
awal dan bukan berarti field optional.

Jangan memakai `username?: string` untuk menghilangkan error ini. `?` mengubah
kontrak TypeScript menjadi “field boleh tidak ada”, padahal `username`, `email`,
dan `password` wajib ada pada request register. Decorator validasi tetap menjadi
pemeriksa nyata terhadap request yang datang.

## Aturan `RegisterDto` yang dipilih

| Field | Aturan | Alasan |
|---|---|---|
| `username` | string, 3–30 karakter | Batas atas selaras dengan `varchar(30)` pada database; batas bawah mencegah username yang hampir kosong. |
| `email` | format email valid, maksimum 254 karakter | Menolak format email yang jelas salah dan selaras dengan `varchar(254)`. |
| `password` | string, 8–72 karakter | Minimum sederhana untuk password; batas atas selaras dengan batas input aman sebelum bcrypt dipakai pada tahap berikutnya. |

Aturan DTO memperbaiki pengalaman API dengan error `400` yang jelas. Constraint
database tetap merupakan perlindungan terakhir untuk aturan data seperti
`UNIQUE username` dan `UNIQUE email`, karena DTO tidak dapat mencegah dua request
bersamaan memilih nilai yang sama.

## Kontrak kepemilikan data register

```text
Client mengirim       → username, email, password
Server/database menambah → UUID, public ID, password hash, timestamps
Server mengembalikan  → hanya field user yang aman untuk publik
```

Request tidak boleh menerima `id`, `public_id`, `password_hash`, atau timestamp
karena semuanya milik server. Response tidak boleh pernah memuat password asli
maupun password hash.

## Mengapa `password_hash` disembunyikan?

TLS melindungi request ketika sedang berjalan di jaringan, tetapi itu tidak
membuat password hash aman untuk diekspos. Hash yang bocor tetap dapat ditebak
secara offline, dan client tidak punya kebutuhan sah untuk menerima hash.
Prinsipnya adalah **least exposure**: kembalikan hanya data yang dibutuhkan
pemanggil API.

## Hash password dengan bcrypt

Pada register, `AuthService` akan memanggil `await bcrypt.hash(password, 10)`
lalu menyimpan hasilnya ke `password_hash`. Password asli tidak disimpan.
Angka `10` adalah *cost factor*: bcrypt sengaja membutuhkan kerja komputasi agar
tebakan password dalam jumlah besar menjadi lebih mahal bagi penyerang. Untuk
challenge ini, nilai tersebut adalah pilihan seimbang dan sederhana.

Pada login nanti, aplikasi tidak meng-hash password lalu membandingkan string.
Ia memakai `await bcrypt.compare(passwordMasuk, hashTersimpan)`, yang
menggunakan salt dan cost dari hash tersimpan. Tidak perlu menyimpan salt di
kolom terpisah.

Pilih API asynchronous (`await`) agar operasi hash tidak memblokir event loop
Node.js selama request lain sedang menunggu.

### Runtime package vs type package

`bcrypt` adalah package runtime: Node.js memuat dan menjalankan kode hashing-nya.
Versi yang terpasang pada project ini tidak menyediakan declaration TypeScript
yang dibutuhkan editor, sehingga tambahkan `@types/bcrypt` sebagai dependency
development. Package `@types/...` hanya memberi TypeScript informasi bentuk API
seperti `hash()` dan `compare()`; ia tidak ikut menjalankan hashing di server.

Jangan menggantikan import dengan deklarasi `require()` buatan sendiri hanya
untuk menghilangkan pesan merah. Deklarasi manual mudah tidak lengkap (misalnya
`compare()` saat login) dan dapat membuat compiler percaya pada API yang keliru.
Setelah type package terpasang, gunakan kembali `import * as bcrypt from
'bcrypt';`.

## Bentuk minimal `AuthService.register`

Service menerima `RegisterDto`, lalu menjalankan urutan berikut:

```text
DTO tervalidasi
  → hash password
  → INSERT username, email, password_hash
  → PostgreSQL mengisi UUID, public ID, dan timestamp
  → pilih hanya id publik, username, email untuk response
```

Service tidak menerima atau membuat `public_id` sendiri. Ketika `values(...)`
tidak menyertakan kolom yang memiliki database default, PostgreSQL menjalankan
default tersebut. Pada response, kita memetakan `users.publicId` menjadi properti
API `id` agar client melihat `U001`, bukan UUID internal.

## Alur yang sedang dibangun

```text
HTTP request
  → ValidationPipe memeriksa RegisterDto
  → AuthController menerima data yang sudah valid
  → AuthService meng-hash password lalu memasukkan user
  → PostgreSQL membuat UUID dan public ID U001 secara otomatis
  → API mengembalikan response user yang aman
```

## Aturan keputusan

Gunakan validation pipe global ketika banyak endpoint membutuhkan perlindungan
input dasar yang konsisten. Gunakan pipe per-route hanya bila suatu route benar-
benar memiliki aturan khusus. Untuk challenge ini, pipe global lebih sederhana
dan menghindari setup yang berulang.
