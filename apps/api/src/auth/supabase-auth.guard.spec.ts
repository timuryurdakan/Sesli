import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { SupabaseAuthGuard, AuthenticatedUser } from './supabase-auth.guard';

const SECRET = 'test-secret';

function makeContext(headers: Record<string, string>): {
  context: ExecutionContext;
  getRequest: () => { user?: AuthenticatedUser };
} {
  const request: { headers: Record<string, string>; user?: AuthenticatedUser } =
    { headers };

  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;

  return { context, getRequest: () => request };
}

describe('SupabaseAuthGuard', () => {
  const originalSecret = process.env.SUPABASE_JWT_SECRET;

  beforeEach(() => {
    process.env.SUPABASE_JWT_SECRET = SECRET;
  });

  afterAll(() => {
    process.env.SUPABASE_JWT_SECRET = originalSecret;
  });

  it('rejects requests without an Authorization header', () => {
    const guard = new SupabaseAuthGuard();
    const { context } = makeContext({});
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects an invalid/expired token', () => {
    const guard = new SupabaseAuthGuard();
    const { context } = makeContext({
      authorization: 'Bearer not-a-real-token',
    });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('accepts a valid token and attaches the user to the request', () => {
    const token = jwt.sign(
      { sub: 'user-123', email: 'test@example.com' },
      SECRET,
    );
    const guard = new SupabaseAuthGuard();
    const { context, getRequest } = makeContext({
      authorization: `Bearer ${token}`,
    });

    expect(guard.canActivate(context)).toBe(true);
    expect(getRequest().user).toEqual({
      id: 'user-123',
      email: 'test@example.com',
    });
  });
});
