import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

function extractBearerToken(request: Request): string | undefined {
  const header = request.headers.authorization;
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' ? token : undefined;
}

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) {
      throw new Error('SUPABASE_JWT_SECRET is not configured');
    }

    try {
      const payload = jwt.verify(token, secret) as jwt.JwtPayload;
      (request as Request & { user: AuthenticatedUser }).user = {
        id: payload.sub as string,
        email: payload.email as string | undefined,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
