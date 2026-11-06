import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/errors/error-response.dto.js';
import { HealthStatusDto, type HealthStatus } from './dto/health-status.dto.js';
import { HealthService } from './health.service.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Check PostgreSQL and Redis availability' })
  @ApiOkResponse({ type: HealthStatusDto })
  @ApiServiceUnavailableResponse({
    type: ErrorResponseDto,
    description: 'At least one dependency is down; the message names it',
  })
  check(): Promise<HealthStatus> {
    return this.healthService.check();
  }
}
