import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type UserRoleName = 'admin' | 'chancellery' | 'user';

export interface CurrentUserPayload {
  id: string;
  login: string;
  role: UserRoleName;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserPayload => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);
