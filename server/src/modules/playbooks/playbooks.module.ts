import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Play, PlaySchema } from '../plays/schemas/play.schema.js';
import { TeamsModule } from '../teams/teams.module.js';
import { PlaybooksController } from './playbooks.controller.js';
import { PlaybooksService } from './playbooks.service.js';
import { Playbook, PlaybookSchema } from './schemas/playbook.schema.js';

@Module({
  imports: [
    TeamsModule,
    MongooseModule.forFeature([
      { name: Playbook.name, schema: PlaybookSchema },
      // Para contar las jugadas de cada playbook y borrarlas junto con él.
      { name: Play.name, schema: PlaySchema },
    ]),
  ],
  controllers: [PlaybooksController],
  providers: [PlaybooksService],
  // PlaysModule lo usa para comprobar que el playbook de una jugada existe y es del equipo.
  exports: [PlaybooksService],
})
export class PlaybooksModule {}
