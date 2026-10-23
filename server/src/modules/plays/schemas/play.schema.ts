import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { PlayDiagram } from '@playbook/shared';
import type { HydratedDocument } from 'mongoose';
import { UUID_ID } from '../../../database/uuid-id.js';

// minimize: false → Mongo guarda también los objetos y arrays vacíos del diagram.
@Schema({ collection: 'plays', timestamps: true, minimize: false })
export class Play {
  @Prop(UUID_ID)
  _id!: string;

  @Prop({ type: String, ref: 'Team', required: true })
  teamId!: string;

  @Prop({ type: String, ref: 'Playbook', required: true })
  playbookId!: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 120 })
  name!: string;

  @Prop({ type: String, ref: 'Formation', default: null })
  formationId!: string | null;

  // En minúsculas: "red zone", "3rd down"...
  @Prop({ type: [String], default: [] })
  tags!: string[];

  // Conceptos del glosario que enseña la jugada (Mesh, Cover 2...).
  @Prop({ type: [String], ref: 'Concept', default: [] })
  conceptIds!: string[];

  // Objeto libre para Mongoose; la forma real la garantiza PlayDiagramSchema (Zod) antes de guardar.
  @Prop({ type: Object, required: true })
  diagram!: PlayDiagram;

  // Bloqueo optimista: cada update filtra por { _id, version } y la incrementa.
  @Prop({ type: Number, required: true, default: 1 })
  version!: number;

  @Prop({ type: String, ref: 'User', required: true })
  createdBy!: string;

  @Prop({ type: String, ref: 'User', required: true })
  updatedBy!: string;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type PlayDocument = HydratedDocument<Play>;

export const PlaySchema = SchemaFactory.createForClass(Play);
PlaySchema.index({ teamId: 1, playbookId: 1, deletedAt: 1, updatedAt: -1 }); // listado de un playbook
PlaySchema.index({ teamId: 1, tags: 1 }); // filtro por tag
PlaySchema.index({ teamId: 1, conceptIds: 1 }); // "jugadas que usan Mesh"
// Búsqueda por texto dentro de un equipo. Sin idioma: con "spanish" Mongo recortaría palabras
// y estropearía términos como "Cover 2".
PlaySchema.index({ teamId: 1, name: 'text', tags: 'text' }, { default_language: 'none' });
