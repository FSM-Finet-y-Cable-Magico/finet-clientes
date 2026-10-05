import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { MailModule } from './mail/mail.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DeudaPublicaModule } from './deuda-publica/deuda-publica.module.js';
import { PortalModule } from './portal/portal.module.js';
import { PerfilModule } from './perfil/perfil.module.js';
import { LandingModule } from './landing/landing.module.js';
import { ContratacionesModule } from './contrataciones/contrataciones.module.js';
import { CoberturaModule } from './cobertura/cobertura.module.js';
import { DiagnosticoModule } from './diagnostico/diagnostico.module.js';
import { AsistenteModule } from './asistente/asistente.module.js';
import { limitePorMinuto } from './asistente/limite-chatbot.js';
import { ConsentimientoModule } from './consentimiento/consentimiento.module.js';
import { NotificacionesModule } from './notificaciones/notificaciones.module.js';
import { PagosModule } from './pagos/pagos.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // CU-67: habilita el @Cron del recordatorio de pago.
    ScheduleModule.forRoot(),
    // 10 por minuto, salvo finet-chatbot, que consulta por todos sus clientes
    // desde una sola IP (ver limite-chatbot.ts).
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: 60_000,
          limit: limitePorMinuto(config),
        },
      ],
    }),
    PrismaModule,
    MailModule,
    AuthModule,
    DeudaPublicaModule,
    PortalModule,
    PerfilModule,
    LandingModule,
    ContratacionesModule,
    CoberturaModule,
    DiagnosticoModule,
    AsistenteModule,
    ConsentimientoModule,
    NotificacionesModule,
    PagosModule,
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
