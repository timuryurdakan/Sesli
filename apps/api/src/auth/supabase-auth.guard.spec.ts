import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SupabaseAuthGuard, AuthenticatedUser } from './supabase-auth.guard';
import { SupabaseService } from '../supabase/supabase.service';

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

function makeSupabase(
  getUser: (
    token: string,
  ) => Promise<{ data: { user: unknown }; error: unknown }>,
): SupabaseService {
  return {
    admin: { auth: { getUser } },
  } as unknown as SupabaseService;
}

describe('SupabaseAuthGuard', () => {
  it('rejects requests without an Authorization header', async () => {
    const guard = new SupabaseAuthGuard(
      makeSupabase(() =>
        Promise.resolve({ data: { user: null }, error: null }),
      ),
    );
    const { context } = makeContext({});
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects an invalid/expired token', async () => {
    const guard = new SupabaseAuthGuard(
      makeSupabase(() =>
        Promise.resolve({
          data: { user: null },
          error: { message: 'invalid' },
        }),
      ),
    );
    const { context } = makeContext({
      authorization: 'Bearer not-a-real-token',
    });
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('accepts a valid token and attaches the user to the request', async () => {
    const guard = new SupabaseAuthGuard(
      makeSupabase((token) => {
        expect(token).toBe('valid-token');
        return Promise.resolve({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });
      }),
    );
    const { context, getRequest } = makeContext({
      authorization: 'Bearer valid-token',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(getRequest().user).toEqual({
      id: 'user-123',
      email: 'test@example.com',
    });
  });
});
