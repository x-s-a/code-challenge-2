import { ConflictException, Inject, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE } from '../database/database.provider';
import * as schema from '../database/schema';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    // Mengambil Drizzle client yang diekspor DatabaseModule.
    @Inject(DATABASE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async register(registerDto: RegisterDto) {
    // Password asli hanya hidup selama request ini; yang disimpan adalah hash.
    const passwordHash = await bcrypt.hash(registerDto.password, 10);

    const [user] = await this.db
      .insert(schema.users)
      .values({
        username: registerDto.username,
        email: registerDto.email,
        passwordHash,
      })
      // Database menangani race condition untuk username/email yang sama.
      .onConflictDoNothing()
      .returning({
        // API mengekspos public ID U001, bukan UUID internal.
        id: schema.users.publicId,
        username: schema.users.username,
        email: schema.users.email,
      });

    if (!user) {
      throw new ConflictException('Username or email already exists');
    }

    return user;
  }
}