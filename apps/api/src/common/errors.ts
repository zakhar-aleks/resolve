import { ConflictException, BadRequestException } from '@nestjs/common';
export function conflict(code: string): never {
  throw new ConflictException({ code, message: code });
}
export function invalid(code: string): never {
  throw new BadRequestException({ code, message: code });
}
