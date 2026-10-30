import { ApiProperty } from '@nestjs/swagger';

export class GlasswareDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true, type: String }) description: string | null;
  @ApiProperty({ nullable: true, type: Number }) capacityMl: number | null;
  @ApiProperty({ nullable: true, type: String }) imageUrl: string | null;
  @ApiProperty() version: number;
  @ApiProperty() updatedAt: Date;
}
