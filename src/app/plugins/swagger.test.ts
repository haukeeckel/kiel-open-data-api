import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { API_NAME } from '../../config/constants.js';
import { withTestEnv } from '../../test/helpers/env.js';

import swaggerPlugin from './swagger.js';

vi.mock('@fastify/swagger', () => ({
  default: vi.fn(),
}));

vi.mock('@fastify/swagger-ui', () => ({
  default: vi.fn(),
}));

describe('swagger plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers swagger with api metadata', async () => {
    const restoreEnv = withTestEnv({
      APP_VERSION: '1.2.3',
      SWAGGER_UI_ENABLED: false,
    });

    try {
      const app = { register: vi.fn(async () => {}) };
      await swaggerPlugin(app as never);

      const swaggerMock = vi.mocked(swagger);
      expect(app.register).toHaveBeenCalledWith(swaggerMock, expect.any(Object));
      const [, optsArg] = (app.register as ReturnType<typeof vi.fn>).mock.calls[0] ?? [];
      expect(optsArg).toMatchObject({
        openapi: {
          info: {
            title: API_NAME,
            description: 'Open data API for Kiel dashboard',
            version: '1.2.3',
          },
        },
      });
      expect(app.register).not.toHaveBeenCalledWith(vi.mocked(swaggerUi), expect.anything());
    } finally {
      restoreEnv();
    }
  });

  it('registers swagger ui when enabled', async () => {
    const restoreEnv = withTestEnv({
      SWAGGER_UI_ENABLED: true,
      SWAGGER_ROUTE_PREFIX: '/docs',
    });

    try {
      const app = { register: vi.fn(async () => {}) };
      await swaggerPlugin(app as never);

      expect(app.register).toHaveBeenCalledWith(vi.mocked(swagger), expect.any(Object));
      const swaggerUiMock = vi.mocked(swaggerUi);
      expect(app.register).toHaveBeenCalledWith(
        swaggerUiMock,
        expect.objectContaining({ routePrefix: '/docs' }),
      );
    } finally {
      restoreEnv();
    }
  });
});
