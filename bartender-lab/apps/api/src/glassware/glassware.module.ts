import { Module } from '@nestjs/common';
import { GlasswareController } from './glassware.controller';

@Module({ controllers: [GlasswareController] })
export class GlasswareModule {}
