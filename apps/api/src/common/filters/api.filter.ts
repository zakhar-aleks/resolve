import type { ArgumentsHost } from '@nestjs/common';
import { Catch, HttpException, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { EntityNotFoundError } from 'typeorm';
@Catch()
export class ApiFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (error instanceof EntityNotFoundError) {
      response.status(404).json({ code: 'NOT_FOUND', message: 'Record not found.' });
      return;
    }
    if (error instanceof HttpException) {
      const value = error.getResponse();
      const code =
        typeof value === 'object' &&
        value !== null &&
        'code' in value &&
        typeof value.code === 'string'
          ? value.code
          : 'REQUEST_REJECTED';
      response.status(error.getStatus()).json({ code, message: error.message });
      return;
    }
    console.error(error instanceof Error ? error.name : 'Unexpected backend failure');
    response
      .status(500)
      .json({ code: 'INTERNAL_ERROR', message: 'The request could not be completed.' });
  }
}
