import { PartialType } from '@nestjs/swagger';
import { CreateConceptDto } from './create-concept.dto.js';

export class UpdateConceptDto extends PartialType(CreateConceptDto) {}
