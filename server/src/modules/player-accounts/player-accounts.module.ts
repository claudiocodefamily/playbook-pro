import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RosterModule } from '../roster/roster.module.js';
import { TeamsModule } from '../teams/teams.module.js';
import { InvitesController, PlayerAccountsController } from './player-accounts.controller.js';
import { PlayerAccountsService } from './player-accounts.service.js';
import { PlayerInvite, PlayerInviteSchema } from './schemas/player-invite.schema.js';

@Module({
  imports: [
    TeamsModule,
    RosterModule,
    MongooseModule.forFeature([{ name: PlayerInvite.name, schema: PlayerInviteSchema }]),
  ],
  controllers: [PlayerAccountsController, InvitesController],
  providers: [PlayerAccountsService],
})
export class PlayerAccountsModule {}
