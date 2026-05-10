import request from 'supertest';
import { createApp } from '../src/app';

describe('GET /health', () => {
  it('returns success envelope', async () => {
    const app = createApp();
    const res = await request(app).get('/health').expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('database');
    expect(res.body.data).toHaveProperty('sockets');
  });
});
