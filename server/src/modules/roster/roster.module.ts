import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TeamsModule } from '../teams/teams.module.js';
import { RosterController } from './roster.controller.js';
import { RosterService } from './roster.service.js';
import { RosterPlayer, RosterPlayerSchema } from './schemas/roster-player.schema.js';

@Module({
  imports: [
    TeamsModule,
    MongooseModule.forFeature([{ name: RosterPlayer.name, schema: RosterPlayerSchema }]),
  ],
  controllers: [RosterController],
  providers: [RosterService],
})
export class RosterModule {}
