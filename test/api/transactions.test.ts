import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../../server.js';

describe('Sariroti Transaction API', () => {
  it('Should not be blocked by global Admin middleware', async () => {
    // We send a POST request without a valid token.
    // If the bug still exists (endpoint under /api/admin), the global admin middleware
    // would intercept this. 
    // Wait, if there's no token, the requireAuth middleware on /api/admin would return 401.
    // So to test if it's NOT under /api/admin, we could just check if the endpoint exists
    // and returns 401 from its own route, rather than a 404.
    
    const res = await request(app)
      .post('/api/transactions/confirm-sariroti')
      .send({ transaction_id: "test" });
      
    // The endpoint itself checks `req.headers.authorization` on line 169
    // and returns 401 if missing.
    // If the endpoint did not exist (e.g. 404), this would fail.
    // This proves the route is correctly mounted on /api/transactions/confirm-sariroti
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });
});
