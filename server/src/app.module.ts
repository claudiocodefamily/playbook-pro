import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.schema.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { FormationsModule } from './modules/formations/formations.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { PlaybooksModule } from './modules/playbooks/playbooks.module.js';
import { PlaysModule } from './modules/plays/plays.module.js';
import { RosterModule } from './modules/roster/roster.module.js';
import { TeamsModule } from './modules/teams/teams.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    TeamsModule,
    RosterModule,
    FormationsModule,
    PlaybooksModule,
    PlaysModule,
    HealthModule,
  ],
})
export class AppModule {}
