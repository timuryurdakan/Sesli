import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { SupabaseService } from '../supabase/supabase.service';

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

/**
 * Token doğrulaması Supabase'in kendi `auth.getUser()` uç noktası üzerinden
 * (uzaktan) yapılır — yerel bir sabit sırla (`jwt.verify(token, secret)`)
 * DEĞİL. Supabase projeleri artık varsayılan olarak asimetrik JWT imzalama
 * anahtarları (ör. ES256) kullanabiliyor; bu durumda sabit bir HS256 sırrıyla
 * yerel doğrulama asla başarılı olmaz (imzalama şeması tamamen farklı).
 * Supabase'in kendi API'sine sorma, hangi imzalama şeması kullanılırsa
 * kullanılsın doğru sonucu verir.
 */
@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const { data, error } = await this.supabase.admin.auth.getUser(token);

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    (request as Request & { user: AuthenticatedUser }).user = {
      id: data.user.id,
      email: data.user.email,
    };
    return true;
  }
}
