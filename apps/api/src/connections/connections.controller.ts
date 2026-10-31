import { SlackService } from '../slack/slack.service';
import { SlackSettingsSchema, type SlackSettings } from './service-settings';
import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ConnectionInputSchema, type ConnectionInput } from '@resolve/contracts';
import { SchemaPipe } from '../common/pipes/schema.pipe';
import { ConnectionsService } from './connections.service';
@Controller('connections')
export class ConnectionsController {
  constructor(
    private readonly connections: ConnectionsService,
    private readonly slack: SlackService,
  ) {}
  @Post('slack') async saveSlack(@Body(new SchemaPipe(SlackSettingsSchema)) input: SlackSettings) {
    await this.connections.saveSlack(input);
    await this.slack.refreshCurrent();
    return { ok: true };
  }
  @Get() status() {
    return this.connections.status();
  }
  @Post() @HttpCode(200) async save(
    @Body(new SchemaPipe(ConnectionInputSchema)) input: ConnectionInput,
  ) {
    await this.connections.save(input);
    return this.connections.status();
  }
  @Post('mistral/test') @HttpCode(200) test() {
    return this.connections.testMistral();
  }
}
