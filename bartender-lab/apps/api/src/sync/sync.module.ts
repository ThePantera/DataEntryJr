import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncPullService } from './sync-pull.service';
import { SyncPushService } from './sync-push.service';

@Module({
  controllers: [SyncController],
  providers: [SyncPullService, SyncPushService],
})
export class SyncModule {}
