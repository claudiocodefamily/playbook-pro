import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TeamAccessGuard } from '../../common/guards/team-access.guard.js';
import { UsersModule } from '../users/users.module.js';
import { Team, TeamSchema } from './schemas/team.schema.js';
import { TeamsController } from './teams.controller.js';
import { TeamsService } from './teams.service.js';

@Module({
  imports: [UsersModule, MongooseModule.forFeature([{ name: Team.name, schema: TeamSchema }])],
  controllers: [TeamsController],
  providers: [TeamsService, TeamAccessGuard],
  // Los módulos con rutas /teams/:teamId/... importan TeamsModule para usar TeamAccessGuard.
  exports: [TeamsService, TeamAccessGuard],
})
export class TeamsModule {}
