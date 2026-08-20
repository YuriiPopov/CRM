import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Проверяет Bearer JWT (см. JwtStrategy); при успехе кладёт AuthenticatedUser в request.user
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
