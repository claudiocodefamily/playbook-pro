import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { User, type UserDocument } from './schemas/user.schema.js';

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  name: string;
}

const DUPLICATE_KEY_ERROR = 11000;

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === DUPLICATE_KEY_ERROR
  );
}

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {}

  /** Crea el usuario. El índice único del email es quien garantiza que no haya dos iguales. */
  async create(input: CreateUserInput): Promise<UserDocument> {
    try {
      return await this.userModel.create(input);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException('Ya existe una cuenta con ese email');
      }
      throw error;
    }
  }

  findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  findByIds(ids: string[]): Promise<UserDocument[]> {
    return this.userModel.find({ _id: { $in: ids } }).exec();
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.trim().toLowerCase() }).exec();
  }

  /** Solo para el login: es la única consulta que trae el hash de la contraseña. */
  findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.trim().toLowerCase() })
      .select('+passwordHash')
      .exec();
  }
}
