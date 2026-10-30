import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/authenticated-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AiAssistantService } from './ai-assistant.service';
import {
  ExplainDto,
  ExplainResponseDto,
  RecommendDto,
  RecommendResponseDto,
  SubstituteDto,
  SubstituteResponseDto,
} from './dto/ai.dto';

@ApiTags('ai')
@Public()
@Controller('ai')
export class AiAssistantController {
  constructor(private readonly assistant: AiAssistantService) {}

  @Post('recommend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recomienda recetas preparables (motor de reglas, sin LLM).' })
  @ApiOkResponse({ type: RecommendResponseDto })
  recommend(
    @Body() dto: RecommendDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<RecommendResponseDto> {
    return this.assistant.recommend(dto, user);
  }

  @Post('substitute')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sustituciones aprobadas para un ingrediente.' })
  @ApiOkResponse({ type: SubstituteResponseDto })
  substitute(
    @Body() dto: SubstituteDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<SubstituteResponseDto> {
    return this.assistant.substitute(dto, user);
  }

  @Post('explain')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Explica una técnica, una receta o un paso con contenido verificado.' })
  @ApiOkResponse({ type: ExplainResponseDto })
  explain(
    @Body() dto: ExplainDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<ExplainResponseDto> {
    return this.assistant.explain(dto, user);
  }
}
