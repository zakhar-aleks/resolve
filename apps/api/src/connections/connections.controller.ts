import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ConnectionInputSchema, type ConnectionInput } from '@resolve/contracts';
import { SchemaPipe } from '../common/pipes/schema.pipe';
import { ConnectionsService } from './connections.service';
@Controller('connections')
export class ConnectionsController {
  constructor(private readonly connections: ConnectionsService) {}
  @Get() status() {
    return this.connections.status();
  }
  @Post() @HttpCode(200) save(@Body(new SchemaPipe(ConnectionInputSchema)) input: ConnectionInput) {
    this.connections.save(input);
    return this.connections.status();
  }
  @Post('mistral/test') @HttpCode(200) test() {
    return this.connections.testMistral();
  }
}
