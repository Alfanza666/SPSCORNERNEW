import type { Request, Response, NextFunction } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AuthenticatedRequest extends Request {
  user?: any;
  profile?: any;
}

export function classifyAuthFailure(error: any): 401 | 503 {
  const message = String(error?.message || error?.cause?.message || '').toLowerCase();
  if (
    Number(error?.status) >= 500
    || message.includes('fetch failed')
    || message.includes('timeout')
    || message.includes('econn')
    || message.includes('und_err')
  ) {
    return 503;
  }
  return 401;
}

export function requireAuth(supabase: SupabaseClient) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
      const token = authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        const status = error ? classifyAuthFailure(error) : 401;
        return res.status(status).json({
          success: false,
          error: status === 503 ? 'Authentication service temporarily unavailable' : 'Unauthorized',
          code: status === 503 ? 'AUTH_UPSTREAM_UNAVAILABLE' : 'UNAUTHORIZED',
        });
      }
      req.user = user;
      next();
    } catch (err) {
      const status = classifyAuthFailure(err);
      return res.status(status).json({
        success: false,
        error: status === 503 ? 'Authentication service temporarily unavailable' : 'Unauthorized',
        code: status === 503 ? 'AUTH_UPSTREAM_UNAVAILABLE' : 'UNAUTHORIZED',
      });
    }
  };
}

export function requireRole(supabase: SupabaseClient, ...roles: string[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', req.user.id)
        .single();
      if (error && error.code !== 'PGRST116') {
        return res.status(503).json({
          success: false,
          error: 'Authorization service temporarily unavailable',
          code: 'AUTHORIZATION_UPSTREAM_UNAVAILABLE',
        });
      }
      if (!profile || !roles.includes(profile.role)) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }
      req.profile = profile;
      next();
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };
}

export const adminOnly = (supabase: SupabaseClient) => [
  requireAuth(supabase),
  requireRole(supabase, 'admin', 'superadmin'),
];
