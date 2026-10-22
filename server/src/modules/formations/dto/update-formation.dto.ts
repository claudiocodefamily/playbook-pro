import { PartialType } from '@nestjs/swagger';
import { CreateFormationDto } from './create-formation.dto.js';

export class UpdateFormationDto extends PartialType(CreateFormationDto) {}
