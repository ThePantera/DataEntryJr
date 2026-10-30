import { ApiProperty } from '@nestjs/swagger';

export class TechniqueEquipmentDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
}

export class TechniqueDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
  @ApiProperty() description: string;
  @ApiProperty({ nullable: true, type: Number, description: 'Duración típica en segundos.' })
  durationSeconds: number | null;
  @ApiProperty() instructions: string;
  @ApiProperty({ type: [String] }) commonMistakes: string[];
  @ApiProperty({ type: [TechniqueEquipmentDto] }) equipment: TechniqueEquipmentDto[];
  @ApiProperty() version: number;
  @ApiProperty() updatedAt: Date;
}
