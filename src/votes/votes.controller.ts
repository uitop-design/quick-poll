import { Body, Controller, Ip, Param, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiGoneResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/errors/error-response.dto.js';
import { PollIdParamDto } from '../polls/dto/poll-id-param.dto.js';
import { PollResultsDto, type PollResults } from '../polls/dto/poll-results.dto.js';
import { CastVoteDto } from './dto/cast-vote.dto.js';
import { VotesService } from './votes.service.js';

@ApiTags('votes')
@Controller('polls/:id/votes')
export class VotesController {
  constructor(private readonly votesService: VotesService) {}

  @Post()
  @ApiOperation({ summary: 'Vote in a poll and get the updated results' })
  @ApiCreatedResponse({ type: PollResultsDto })
  @ApiBadRequestResponse({
    type: ErrorResponseDto,
    description: 'Validation failed or the option belongs to another poll',
  })
  @ApiNotFoundResponse({ type: ErrorResponseDto, description: 'Poll not found' })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'Voter has already voted' })
  @ApiGoneResponse({ type: ErrorResponseDto, description: 'Poll is closed' })
  @ApiTooManyRequestsResponse({
    type: ErrorResponseDto,
    description: 'More than the allowed number of votes per minute from one IP',
    headers: {
      'Retry-After': {
        description: 'Seconds until voting is allowed again',
        schema: { type: 'integer' },
      },
    },
  })
  vote(
    @Param() { id }: PollIdParamDto,
    @Body() dto: CastVoteDto,
    @Ip() clientIp: string,
  ): Promise<PollResults> {
    return this.votesService.vote(id, dto, clientIp);
  }
}
