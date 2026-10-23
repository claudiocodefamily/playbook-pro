import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { migrateDiagram } from '@playbook/shared';
import type { Model } from 'mongoose';
import {
  hashSecretToken,
  isSecretTokenShape,
  newSecretToken,
} from '../../common/utils/secret-token.js';
import { ConceptsService } from '../concepts/concepts.service.js';
import { PlaybooksService } from '../playbooks/playbooks.service.js';
import { Play } from '../plays/schemas/play.schema.js';
import { TeamsService } from '../teams/teams.service.js';
import type { CreateShareLinkDto } from './dto/create-share-link.dto.js';
import type { SharedPlaybookResponseDto } from './dto/shared-playbook-response.dto.js';
import { ShareLink, type ShareLinkDocument } from './schemas/share-link.schema.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
// El mismo mensaje para un link que no existe, caducó o se revocó: no da pistas.
const LINK_NOT_FOUND = 'Este link no existe, caducó o el coach lo desactivó';

@Injectable()
export class ShareLinksService {
  constructor(
    @InjectModel(ShareLink.name) private readonly linkModel: Model<ShareLink>,
    @InjectModel(Play.name) private readonly playModel: Model<Play>,
    private readonly playbooks: PlaybooksService,
    private readonly teams: TeamsService,
    private readonly concepts: ConceptsService,
  ) {}

  /** Crea el link. El token se devuelve solo aquí; en la base de datos queda su hash. */
  async create(
    teamId: string,
    playbookId: string,
    userId: string,
    dto: CreateShareLinkDto,
  ): Promise<{ link: ShareLinkDocument; token: string }> {
    await this.playbooks.findOne(teamId, playbookId);
    const token = newSecretToken();
    const link = await this.linkModel.create({
      teamId,
      playbookId,
      tokenHash: hashSecretToken(token),
      label: dto.label ?? '',
      expiresAt: dto.expiresInDays ? new Date(Date.now() + dto.expiresInDays * DAY_IN_MS) : null,
      createdBy: userId,
    });
    return { link, token };
  }

  /** Links activos del playbook (sin revocar ni caducados), los más nuevos primero. */
  async findActive(teamId: string, playbookId: string): Promise<ShareLinkDocument[]> {
    await this.playbooks.findOne(teamId, playbookId);
    return this.linkModel
      .find({
        teamId,
        playbookId,
        revokedAt: null,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  /** Desactiva el link: quien lo tenga deja de poder abrirlo. */
  async revoke(teamId: string, playbookId: string, linkId: string): Promise<void> {
    const result = await this.linkModel
      .updateOne(
        { _id: linkId, teamId, playbookId, revokedAt: null },
        { $set: { revokedAt: new Date() } },
      )
      .exec();
    if (result.matchedCount === 0) throw new NotFoundException('Link no encontrado');
  }

  /** Lo que ve quien abre el link: el playbook con sus jugadas, sin poder cambiar nada. */
  async open(token: string): Promise<SharedPlaybookResponseDto> {
    if (!isSecretTokenShape(token)) throw new NotFoundException(LINK_NOT_FOUND);
    const link = await this.linkModel.findOne({ tokenHash: hashSecretToken(token) }).exec();
    if (!link || link.revokedAt || (link.expiresAt && link.expiresAt <= new Date())) {
      throw new NotFoundException(LINK_NOT_FOUND);
    }
    const { teamId, playbookId } = link;
    const [team, playbook, plays, concepts] = await Promise.all([
      this.teams.findOne(teamId),
      this.playbooks.findOne(teamId, playbookId).catch(() => null),
      this.playModel.find({ teamId, playbookId, deletedAt: null }).sort({ name: 1 }).exec(),
      this.concepts.findAll(teamId),
    ]);
    // Si borraron el playbook, el link deja de funcionar.
    if (!playbook) throw new NotFoundException(LINK_NOT_FOUND);
    const used = new Set(plays.flatMap((play) => play.conceptIds));
    return {
      teamName: team.name,
      ruleset: team.ruleset,
      name: playbook.name,
      side: playbook.side,
      description: playbook.description,
      plays: plays.map((play) => ({
        id: play._id,
        name: play.name,
        tags: [...play.tags],
        conceptIds: [...play.conceptIds],
        diagram: migrateDiagram(play.diagram),
      })),
      concepts: concepts
        .filter((concept) => used.has(concept._id))
        .map((concept) => ({
          id: concept._id,
          name: concept.name,
          explanation: concept.explanation,
        })),
    };
  }
}
