import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/errors/error-response.dto.js';
import { CreatePollDto } from './dto/create-poll.dto.js';
import { ListPollsQueryDto } from './dto/list-polls-query.dto.js';
import { PollIdParamDto } from './dto/poll-id-param.dto.js';
import {
  PollPageDto,
  type PollPage,
  PollResultsDto,
  type PollResults,
} from './dto/poll-results.dto.js';
import { PollsService } from './polls.service.js';

@ApiTags('polls')
@ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Validation failed' })
@Controller('polls')
export class PollsController {
  constructor(private readonly pollsService: PollsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a poll' })
  @ApiCreatedResponse({ type: PollResultsDto })
  create(@Body() dto: CreatePollDto): Promise<PollResults> {
    return this.pollsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List polls, newest first' })
  @ApiOkResponse({ type: PollPageDto })
  list(@Query() query: ListPollsQueryDto): Promise<PollPage> {
    return this.pollsService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a poll with its current results' })
  @ApiOkResponse({ type: PollResultsDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  get(@Param() { id }: PollIdParamDto): Promise<PollResults> {
    return this.pollsService.getResults(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a poll with its options and votes' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  delete(@Param() { id }: PollIdParamDto): Promise<void> {
    return this.pollsService.delete(id);
  }
}
