import { Controller, Get, Query } from '@nestjs/common';
import { DeudaPublicaService } from './deuda-publica.service.js';
import { ZodValidationPipe } from '../auth/pipes/zod-validation.pipe.js';
import { ConsultaDeudaRutDto } from './dto/deuda-publica.dto.js';

@Controller('deuda-publica')
export class DeudaPublicaController {
  constructor(private readonly deudaPublicaService: DeudaPublicaService) {}

  @Get('rut')
  consultarPorRut(
    @Query(new ZodValidationPipe(ConsultaDeudaRutDto))
    query: ConsultaDeudaRutDto,
  ) {
    return this.deudaPublicaService.consultarPorRut(query.rut);
  }
}
