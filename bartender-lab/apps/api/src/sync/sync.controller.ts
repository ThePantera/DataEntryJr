import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/authenticated-user';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import {
  ChangesQueryDto,
  ChangesResponseDto,
  ManifestQueryDto,
  ManifestResponseDto,
  SyncPushDto,
  SyncPushResponseDto,
} from './dto/sync.dto';
import { SyncPullService } from './sync-pull.service';
import { SyncPushService } from './sync-push.service';

@ApiTags('sync')
@Controller('sync')
export class SyncController {
  constructor(
    private readonly pull: SyncPullService,
    private readonly pushService: SyncPushService,
  ) {}

  @Get('manifest')
  @Public()
  @ApiOperation({ summary: 'Versión publicada de cada recurso descargable.' })
  @ApiOkResponse({ type: ManifestResponseDto })
  manifest(@Query() query: ManifestQueryDto): Promise<ManifestResponseDto> {
    return this.pull.manifest(query.types);
  }

  @Get('changes')
  @Public()
  @ApiOperation({
    summary:
      'Cambios desde un cursor: contenido público y, si hay token, los datos propios con lápidas.',
  })
  @ApiOkResponse({ type: ChangesResponseDto })
  changes(
    @Query() query: ChangesQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<ChangesResponseDto> {
    return this.pull.changes(query.since ? new Date(query.since) : undefined, user?.id);
  }

  @Post('push')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Aplica la cola de operaciones pendientes del cliente (idempotente por opId).',
  })
  @ApiOkResponse({ type: SyncPushResponseDto })
  push(
    @Body() dto: SyncPushDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SyncPushResponseDto> {
    return this.pushService.push(user.id, dto);
  }
}
