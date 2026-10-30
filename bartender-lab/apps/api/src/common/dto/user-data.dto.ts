import { ApiProperty } from '@nestjs/swagger';

/** Fields shared by every synchronisable user record. */
export class SyncedRecordDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ description: 'Se incrementa en cada cambio; base de la detección de conflictos.' })
  version: number;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
  @ApiProperty({
    nullable: true,
    type: Date,
    description: 'No nulo = eliminado (lápida para sync).',
  })
  deletedAt: Date | null;
}
