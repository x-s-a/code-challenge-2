import { Module } from '@nestjs/common';
import { DATABASE, databaseProvider } from './database.provider';

@Module({
  // Mendaftarkan provider ke dependency injection NestJS.
  providers: [databaseProvider],

  // Membuat database client bisa dipakai module lain.
  exports: [DATABASE],
})
export class DatabaseModule {}