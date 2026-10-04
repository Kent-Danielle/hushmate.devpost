import { ConflictException, Injectable, type OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { MeService, type UserShape } from '../me/me.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { SignInDto } from './dto/signin.dto.js';
import type { SignUpDto } from './dto/signup.dto.js';

const HASH_OPTIONS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export interface AuthResult {
  token: string;
  user: UserShape;
}

@Injectable()
export class AuthService implements OnModuleInit {
  /** Verified against when the email is unknown, so timing doesn't reveal which emails exist. */
  private dummyHash = '';

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly me: MeService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = await argon2.hash(randomBytes(16).toString('hex'), HASH_OPTIONS);
  }

  async signUp(dto: SignUpDto): Promise<AuthResult> {
    const passwordHash = await argon2.hash(dto.password, HASH_OPTIONS);
    let id: string;
    try {
      const created = await this.prisma.user.create({
        data: { name: dto.name, email: dto.email, passwordHash },
        select: { id: true },
      });
      id = created.id;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('That email is already registered');
      }
      throw error;
    }
    return this.issue(id);
  }

  async signIn(dto: SignInDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, passwordHash: true, isBot: true },
    });
    const hash = user?.passwordHash ?? this.dummyHash;
    const ok = await argon2.verify(hash, dto.password).catch(() => false);
    if (!user || !user.passwordHash || user.isBot || !ok) {
      throw new UnauthorizedException('Wrong email or password');
    }
    return this.issue(user.id);
  }

  private async issue(userId: string): Promise<AuthResult> {
    const token = await this.jwt.signAsync({ sub: userId });
    return { token, user: await this.me.getUser(userId) };
  }
}
