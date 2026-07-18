import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { registerMiscRoutes } from '../routes/misc';

describe('legacy receipt validator compatibility', () => {
  it('routes old clients without cart items to manual pending before calling AI', async () => {
    const groqCreate = vi.fn();
    const app = express();
    app.use(express.json());
    registerMiscRoutes(app, {
      supabase: {},
      sendNotification: vi.fn(),
      groq: { chat: { completions: { create: groqCreate } } },
      sendSarirotiEmailInternal: vi.fn(),
    });

    const response = await request(app)
      .post('/api/validate/receipt')
      .send({
        imageBase64: 'aGVsbG8=',
        totalAmount: 25_000,
        mimeType: 'image/png',
      })
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      data: expect.objectContaining({
        valid: false,
        fallbackToPending: true,
      }),
    });
    expect(groqCreate).not.toHaveBeenCalled();
  });
});
