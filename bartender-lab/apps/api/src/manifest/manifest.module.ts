import { Global, Module } from '@nestjs/common';
import { ManifestService } from './manifest.service';

@Global()
@Module({
  providers: [ManifestService],
  exports: [ManifestService],
})
export class ManifestModule {}
