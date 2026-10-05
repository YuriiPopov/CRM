import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';
import { UploadNewsImageDto } from './dto/upload-news-image.dto';
import { NewsService } from './news.service';

// Управление новостями салона — только ADMIN (MASTER получает 403). Клиентская лента —
// GET /client/news в ClientPortalController.
@Controller('news')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.newsService.findAll(user.salonId);
  }

  @Post()
  create(@Body() dto: CreateNewsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.newsService.create(dto, user.salonId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNewsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.newsService.update(id, dto, user.salonId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.newsService.remove(id, user.salonId);
  }

  @Post(':id/image')
  uploadImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UploadNewsImageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.newsService.uploadImage(id, dto, user.salonId);
  }

  @Delete(':id/image')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeImage(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.newsService.removeImage(id, user.salonId);
  }
}
