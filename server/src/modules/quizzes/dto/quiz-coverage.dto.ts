import { ApiProperty } from '@nestjs/swagger';
import { POSITIONS, type Position } from '@playbook/shared';
import { IsUUID } from 'class-validator';

export class QuizCoverageQueryDto {
  @ApiProperty({ format: 'uuid', description: 'Playbook del que saldrían las preguntas' })
  @IsUUID(7)
  playbookId!: string;
}

export class PositionCoverageDto {
  @ApiProperty({ enum: POSITIONS })
  position!: Position;

  @ApiProperty({ description: 'Preguntas que saldrían de esa posición, sin el límite del quiz' })
  questions!: number;
}

/** Qué posiciones tienen tareas dibujadas en el playbook, para elegir antes de crear el quiz. */
export class QuizCoverageResponseDto {
  @ApiProperty({
    type: [PositionCoverageDto],
    description: 'Solo las posiciones con alguna pregunta, en el orden de POSITIONS',
  })
  positions!: PositionCoverageDto[];
}
