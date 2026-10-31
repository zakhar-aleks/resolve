import { Body, Controller, Get, Post } from '@nestjs/common';
import { z } from 'zod';
import { SchemaPipe } from '../common/pipes/schema.pipe';
import { AuthService } from './auth.service';
import {
  BeginSchema,
  CallbackSchema,
  InviteSchema,
  OnboardSchema,
  SessionInputSchema,
} from './schemas';
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Get('health') health() {
    return this.auth.health();
  }
  @Get('providers') providers() {
    return this.auth.providers();
  }
  @Post('begin') begin(@Body(new SchemaPipe(BeginSchema)) input: z.infer<typeof BeginSchema>) {
    return this.auth.begin(input.provider, input.browserSecret);
  }
  @Post('callback') callback(
    @Body(new SchemaPipe(CallbackSchema)) input: z.infer<typeof CallbackSchema>,
  ) {
    return this.auth.callback(input.provider, input.state, input.code, input.browserSecret);
  }
  @Post('session') session(
    @Body(new SchemaPipe(SessionInputSchema)) input: z.infer<typeof SessionInputSchema>,
  ) {
    return this.auth.profile(input.token);
  }
  @Post('onboard') onboard(
    @Body(new SchemaPipe(OnboardSchema)) input: z.infer<typeof OnboardSchema>,
  ) {
    return this.auth.onboard(input.token, input.companyName, input.inviteToken);
  }
  @Post('invite') invite(@Body(new SchemaPipe(InviteSchema)) input: z.infer<typeof InviteSchema>) {
    return this.auth.invite(input.token, input.email, input.role);
  }
  @Post('switch') switch(
    @Body(new SchemaPipe(SessionInputSchema.extend({ workspaceId: z.uuid() })))
    input: {
      token: string;
      workspaceId: string;
    },
  ) {
    return this.auth.switchWorkspace(input.token, input.workspaceId);
  }
  @Post('team') team(
    @Body(new SchemaPipe(SessionInputSchema)) input: z.infer<typeof SessionInputSchema>,
  ) {
    return this.auth.team(input.token);
  }
  @Post('remove-member') removeMember(
    @Body(new SchemaPipe(SessionInputSchema.extend({ userId: z.uuid() })))
    input: {
      token: string;
      userId: string;
    },
  ) {
    return this.auth.removeMember(input.token, input.userId);
  }
  @Post('api-keys') apiKeys(
    @Body(new SchemaPipe(SessionInputSchema)) input: z.infer<typeof SessionInputSchema>,
  ) {
    return this.auth.apiKeys(input.token);
  }
  @Post('logout') logout(
    @Body(new SchemaPipe(SessionInputSchema)) input: z.infer<typeof SessionInputSchema>,
  ) {
    return this.auth.logout(input.token);
  }
}
