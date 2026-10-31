import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
export class SchemaPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T>) {}
  transform(value: unknown): T {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success)
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Request did not match the API contract.',
      });
    return parsed.data;
  }
}
