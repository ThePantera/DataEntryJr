import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { TechniqueDto } from './dto/techniques.dto';
import { TechniquesService } from './techniques.service';

@ApiTags('techniques')
@Public()
@Controller('techniques')
export class TechniquesController {
  constructor(private readonly techniques: TechniquesService) {}

  @Get()
  @ApiOkResponse({ type: [TechniqueDto] })
  list(): Promise<TechniqueDto[]> {
    return this.techniques.list();
  }

  @Get(':id')
  @ApiOkResponse({ type: TechniqueDto })
  @ApiNotFoundResponse()
  get(@Param('id', new ParseUUIDPipe()) id: string): Promise<TechniqueDto> {
    return this.techniques.get(id);
  }
}
