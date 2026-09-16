// Membaca DATABASE_URL melalui sistem konfigurasi NestJS.
import { ConfigService } from '@nestjs/config';

// Adapter Drizzle untuk driver node-postgres.
import { drizzle } from 'drizzle-orm/node-postgres';

// Connection pool dari driver PostgreSQL.
import { Pool } from 'pg';

// Definisi tabel yang dipakai untuk type-safe query.
import * as schema from './schema';

// Token/nama yang dipakai NestJS untuk menemukan database client ini.
export const DATABASE = 'DATABASE';

// Custom factory provider yang membuat database client saat NestJS start.
export const databaseProvider = {
  // Nama provider yang nanti dipakai saat injection.
  provide: DATABASE,

  // Dependency yang akan dikirim NestJS ke useFactory.
  inject: [ConfigService],

  // Factory ini dijalankan sekali oleh NestJS untuk membuat Drizzle client.
  useFactory: (configService: ConfigService) => {
    // Gagal dengan jelas jika DATABASE_URL tidak tersedia.
    const connectionString =
      configService.getOrThrow<string>('DATABASE_URL');

    // Membuat connection pool PostgreSQL.
    const pool = new Pool({ connectionString });

    // Membungkus pool dengan Drizzle dan schema kita.
    return drizzle({ client: pool, schema });
  },
};