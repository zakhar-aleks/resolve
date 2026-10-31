import { Controller, Get } from '@nestjs/common';
import { StateService } from './state.service';
@Controller('state')
export class StateController {
  constructor(private readonly state: StateService) {}
  @Get() get() {
    return this.state.get();
  }
}
