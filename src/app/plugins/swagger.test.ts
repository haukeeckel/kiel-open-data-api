import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';

import { API_NAME } from '../../config/constants.js';
import { makeEnv } from '../../test/helpers/makeEnv.js';

import swaggerPlugin from './swagger.js';

describe('swagger plugin', () => {
  it('exposes swagger spec with api metadata', async () => {
    const env = makeEnv({
      APP_VERSION: '1.2.3',
      SWAGGER_UI_ENABLED: false,
    });

    const app = Fastify();
    await app.register(swaggerPlugin, { env });
    await app.ready();

    const spec = app.swagger();
    expect(spec.info).toMatchObject({
      title: API_NAME,
      description: 'Open data API for Kiel dashboard',
      version: '1.2.3',
    });

    await app.close();
  });

  it('serves swagger ui when enabled', async () => {
    const env = makeEnv({
      SWAGGER_UI_ENABLED: true,
      SWAGGER_ROUTE_PREFIX: '/docs',
    });

    const app = Fastify();
    await app.register(swaggerPlugin, { env });
    await app.ready();

    const uiRes = await app.inject({ method: 'GET', url: '/docs' });
    expect(uiRes.statusCode).toBe(200);
    expect(uiRes.headers['content-type']).toMatch(/text\/html/i);

    const jsonRes = await app.inject({ method: 'GET', url: '/docs/json' });
    expect(jsonRes.statusCode).toBe(200);
    expect(jsonRes.json()).toMatchObject({
      info: { title: API_NAME },
    });

    await app.close();
  });
});
