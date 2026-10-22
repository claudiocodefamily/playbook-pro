import { PartialType } from '@nestjs/swagger';
import { CreatePlaybookDto } from './create-playbook.dto.js';

export class UpdatePlaybookDto extends PartialType(CreatePlaybookDto) {}
