import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { MasterBlocksService } from './master-blocks.service';
import { CreateMasterBlockDto } from './dto/create-master-block.dto';
import { ListMasterBlocksQueryDto } from './dto/list-master-blocks-query.dto';

@Controller('master-blocks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MasterBlocksController {
  constructor(private readonly masterBlocksService: MasterBlocksService) {}

  @Post()
  @Roles(Role.ADMIN, Role.MASTER)
  create(
    @Body() dto: CreateMasterBlockDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.masterBlocksService.create(dto, user);
  }

  @Get()
  @Roles(Role.ADMIN, Role.MASTER)
  findAll(
    @Query() query: ListMasterBlocksQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.masterBlocksService.findAll(query, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.MASTER)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.masterBlocksService.remove(id, user);
  }
}
