import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlaybooksModule } from '../playbooks/playbooks.module.js';
import { Play, PlaySchema } from '../plays/schemas/play.schema.js';
import { TeamsModule } from '../teams/teams.module.js';
import { GamePlansController } from './game-plans.controller.js';
import { GamePlansService } from './game-plans.service.js';
import { GamePlan, GamePlanSchema } from './schemas/game-plan.schema.js';

@Module({
  imports: [
    TeamsModule,
    PlaybooksModule,
    MongooseModule.forFeature([
      { name: GamePlan.name, schema: GamePlanSchema },
      // Para comprobar y nombrar las jugadas de cada situación.
      { name: Play.name, schema: PlaySchema },
    ]),
  ],
  controllers: [GamePlansController],
  providers: [GamePlansService],
})
export class GamePlansModule {}
