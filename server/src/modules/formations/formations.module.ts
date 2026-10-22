import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TeamsModule } from '../teams/teams.module.js';
import { FormationsController } from './formations.controller.js';
import { FormationsSeeder } from './formations.seeder.js';
import { FormationsService } from './formations.service.js';
import { Formation, FormationSchema } from './schemas/formation.schema.js';

@Module({
  imports: [
    TeamsModule,
    MongooseModule.forFeature([{ name: Formation.name, schema: FormationSchema }]),
  ],
  controllers: [FormationsController],
  providers: [FormationsService, FormationsSeeder],
  // PlaysModule lo usa para colocar los jugadores de una jugada nueva según una formación.
  exports: [FormationsService],
})
export class FormationsModule {}
