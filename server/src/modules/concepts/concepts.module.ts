import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Play, PlaySchema } from '../plays/schemas/play.schema.js';
import { TeamsModule } from '../teams/teams.module.js';
import { ConceptsController } from './concepts.controller.js';
import { ConceptsSeeder } from './concepts.seeder.js';
import { ConceptsService } from './concepts.service.js';
import { Concept, ConceptSchema } from './schemas/concept.schema.js';

@Module({
  imports: [
    TeamsModule,
    MongooseModule.forFeature([
      { name: Concept.name, schema: ConceptSchema },
      // Para contar y listar las jugadas de cada concepto y quitarlo de ellas al borrarlo.
      { name: Play.name, schema: PlaySchema },
    ]),
  ],
  controllers: [ConceptsController],
  providers: [ConceptsService, ConceptsSeeder],
  // PlaysModule lo usa para validar los conceptos que enlaza una jugada.
  exports: [ConceptsService],
})
export class ConceptsModule {}
