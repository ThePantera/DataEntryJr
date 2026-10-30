import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { UserRole } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { APP_CONFIG, type AppConfig } from '../../src/config/env.validation';
import { PrismaService } from '../../src/prisma/prisma.service';

export const API = '/api/v1';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  http: () => ReturnType<typeof request>;
}

/** Boots the real AppModule with the same HTTP pipeline as production. */
export async function createTestApp(
  envOverrides: Record<string, string> = {},
): Promise<TestContext> {
  const previous = Object.fromEntries(Object.keys(envOverrides).map((k) => [k, process.env[k]]));
  Object.assign(process.env, envOverrides);
  try {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: ['error'] });
    configureApp(app, app.get<AppConfig>(APP_CONFIG));
    await app.init();
    return { app, prisma: app.get(PrismaService), http: () => request(app.getHttpServer()) };
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

/** Empties every table (keeps the migrations table). */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
}

let userCounter = 0;

/** Registers a user through the API, optionally promotes it, and returns fresh tokens. */
export async function createUser(ctx: TestContext, role: UserRole = 'USER'): Promise<TestUser> {
  userCounter += 1;
  const email = `user${userCounter}-${Date.now()}@example.com`;
  const password = 'a-very-good-password';
  const res = await ctx
    .http()
    .post(`${API}/auth/register`)
    .send({ email, password, displayName: `User ${userCounter}` })
    .expect(201);
  if (role !== 'USER') {
    await ctx.prisma.user.update({ where: { id: res.body.user.id }, data: { role } });
  }
  return {
    id: res.body.user.id,
    email,
    password,
    accessToken: res.body.accessToken,
    refreshToken: res.body.refreshToken,
  };
}

export const bearer = (user: TestUser) => ({ Authorization: `Bearer ${user.accessToken}` });
