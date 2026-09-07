import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { MailModule } from './mail/mail.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DeudaPublicaModule } from './deuda-publica/deuda-publica.module.js';
import { PortalModule } from './portal/portal.module.js';
import { AdminModule } from './admin/admin.module.js';
import { PerfilModule } from './perfil/perfil.module.js';
import { LandingModule } from './landing/landing.module.js';
import { ContratacionesModule } from './contrataciones/contrataciones.module.js';
import { CoberturaModule } from './cobertura/cobertura.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 10,
      },
    ]),
    PrismaModule,
    MailModule,
    AuthModule,
    DeudaPublicaModule,
    PortalModule,
    AdminModule,
    PerfilModule,
    LandingModule,
    ContratacionesModule,
    CoberturaModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
