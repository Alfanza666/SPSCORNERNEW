import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerMiscRoutes } from '../../src/routes/misc.js';

function createApp(modelResponses: unknown[]) {
  const app = express();
  app.use(express.json());

  const create = vi.fn();
  for (const response of modelResponses) {
    create.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(response) } }],
    });
  }

  const single = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null });
  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'admin-id' } }, error: null }),
    },
    from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ single })) })) })),
  };

  registerMiscRoutes(app, {
    supabase,
    groq: { chat: { completions: { create } } },
    sendNotification: vi.fn(),
    sendSarirotiEmailInternal: vi.fn(),
  });

  return { app, create };
}

describe('POST /api/ai/generate-form', () => {
  beforeEach(() => vi.stubEnv('GROQ_API_KEY', 'test-groq-key'));
  afterEach(() => vi.unstubAllEnvs());

  it('menolak request tanpa token', async () => {
    const { app, create } = createApp([]);
    const response = await request(app).post('/api/ai/generate-form').send({ prompt: 'Buat form' });

    expect(response.status).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });

  it('menerapkan schema, menjaga id database, dan memetakan conditional id', async () => {
    const { app } = createApp([{
      message: 'Form selesai dibuat.',
      updatedForm: {
        id: 'id_form_jika_ada',
        title: 'Form Bersyarat',
        fields: [
          {
            id: 'Pilihan Ya?', type: 'radio', label: 'Bersedia?', required: true,
            options: [{ value: 'yes', label: 'Ya' }, { value: 'no', label: 'Tidak' }],
          },
          {
            id: 'Alasan', type: 'textarea', label: 'Alasan', required: true,
            condition: { fieldId: 'Pilihan Ya?', operator: 'eq', value: 'Ya' },
          },
        ],
      },
    }]);

    const response = await request(app)
      .post('/api/ai/generate-form')
      .set('Authorization', 'Bearer valid-token')
      .send({
        prompt: 'Buat form bercabang',
        currentForm: { id: 'database-form-id', title: 'Lama', fields: [] },
      });

    expect(response.status).toBe(200);
    expect(response.body.updatedForm.id).toBe('database-form-id');
    expect(response.body.updatedForm.fields[0].id).toBe('pilihan_ya');
    expect(response.body.updatedForm.fields[1].condition).toEqual({
      fieldId: 'pilihan_ya', operator: 'eq', value: 'yes',
    });
  });

  it('mengulang sekali ketika model hanya membalas chat', async () => {
    const { app, create } = createApp([
      { message: 'Tentu, saya bantu.' },
      {
        message: 'Form berhasil dibuat.',
        updatedForm: {
          title: 'Pendaftaran',
          fields: [{ id: 'nama', type: 'text', label: 'Nama', required: true }],
        },
      },
    ]);

    const response = await request(app)
      .post('/api/ai/generate-form')
      .set('Authorization', 'Bearer valid-token')
      .send({ prompt: 'Buat form pendaftaran' });

    expect(response.status).toBe(200);
    expect(response.body.updatedForm.fields).toHaveLength(1);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('gagal eksplisit jika dua respons tetap tidak memiliki schema', async () => {
    const { app } = createApp([
      { message: 'Saya siap membantu.' },
      { message: 'Silakan jelaskan kebutuhannya.' },
    ]);

    const response = await request(app)
      .post('/api/ai/generate-form')
      .set('Authorization', 'Bearer valid-token')
      .send({ prompt: 'Buat form pendaftaran' });

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
  });
});
