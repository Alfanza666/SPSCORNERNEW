import type { Request, Response, NextFunction } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AuthenticatedRequest extends Request {
  user?: any;
  profile?: any;
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
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
      req.user = user;
      next();
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  };
}

export function requireRole(supabase: SupabaseClient, ...roles: string[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', req.user.id)
        .single();
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
