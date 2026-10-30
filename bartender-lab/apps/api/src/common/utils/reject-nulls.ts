import { BadRequestException } from '@nestjs/common';

/**
 * PATCH DTOs accept null to clear optional fields; this rejects null for fields that are required,
 * so a bad request answers 400 instead of failing at the database.
 */
export function rejectNulls<T extends object>(dto: T, fields: ReadonlyArray<keyof T>): void {
  const invalid = fields.filter((field) => dto[field] === null);
  if (invalid.length > 0) {
    throw new BadRequestException(invalid.map((field) => `${String(field)} must not be null`));
  }
}
