import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ACCESS_COOKIE } from './cookies';
import { type AccessClaims, TokensService } from './tokens.service';

type AuthedRequest = Request & { auth?: AccessClaims };

/** Requires a valid access token from the pn_at cookie (or a Bearer header for tooling). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly tokens: TokensService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const cookieToken = (req.cookies as Record<string, string | undefined>)[ACCESS_COOKIE];
    const header = req.header('authorization');
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const token = cookieToken ?? bearer;

    const claims = token ? await this.tokens.verifyAccess(token) : null;
    if (!claims) {
      throw new UnauthorizedException({ code: 'unauthenticated', message: 'Please log in.' });
    }
    req.auth = claims;
    return true;
  }
}

/** The authenticated photographer's claims; use only on routes behind AuthGuard. */
export const CurrentAuth = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const req = context.switchToHttp().getRequest<AuthedRequest>();
  if (!req.auth) throw new UnauthorizedException();
  return req.auth;
});
