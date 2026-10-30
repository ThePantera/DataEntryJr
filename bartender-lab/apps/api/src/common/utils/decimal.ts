import type { Prisma } from '@prisma/client';

/** Prisma returns NUMERIC columns as Decimal; the API exposes plain JSON numbers. */
export function toNumber(value: Prisma.Decimal | null): number | null {
  return value === null ? null : value.toNumber();
}
