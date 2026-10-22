import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FormationsModule } from '../formations/formations.module.js';
import { PlaybooksModule } from '../playbooks/playbooks.module.js';
import { TeamsModule } from '../teams/teams.module.js';
import { PlaybookPlaysController, PlaysController } from './plays.controller.js';
import { PlaysService } from './plays.service.js';
import { PlayVersion, PlayVersionSchema } from './schemas/play-version.schema.js';
import { Play, PlaySchema } from './schemas/play.schema.js';

@Module({
  imports: [
    TeamsModule,
    PlaybooksModule,
    FormationsModule,
    MongooseModule.forFeature([
      { name: Play.name, schema: PlaySchema },
      { name: PlayVersion.name, schema: PlayVersionSchema },
    ]),
  ],
  controllers: [PlaybookPlaysController, PlaysController],
  providers: [PlaysService],
})
export class PlaysModule {}
