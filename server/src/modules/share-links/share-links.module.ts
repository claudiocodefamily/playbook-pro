import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConceptsModule } from '../concepts/concepts.module.js';
import { PlaybooksModule } from '../playbooks/playbooks.module.js';
import { Play, PlaySchema } from '../plays/schemas/play.schema.js';
import { TeamsModule } from '../teams/teams.module.js';
import { ShareLink, ShareLinkSchema } from './schemas/share-link.schema.js';
import { SharedPlaybookController, ShareLinksController } from './share-links.controller.js';
import { ShareLinksService } from './share-links.service.js';

@Module({
  imports: [
    TeamsModule,
    PlaybooksModule,
    ConceptsModule,
    MongooseModule.forFeature([
      { name: ShareLink.name, schema: ShareLinkSchema },
      { name: Play.name, schema: PlaySchema },
    ]),
  ],
  controllers: [ShareLinksController, SharedPlaybookController],
  providers: [ShareLinksService],
})
export class ShareLinksModule {}
