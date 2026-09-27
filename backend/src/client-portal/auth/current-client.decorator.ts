import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedClient } from './client-jwt';

export const CurrentClient = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedClient => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ user: AuthenticatedClient }>();
    return request.user;
  },
);
