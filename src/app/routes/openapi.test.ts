import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { API_NAME } from '../../config/constants.js';
import { cleanupDuckDbFiles, makeAppAndSeed } from '../../test/helpers/app.js';
import { type buildServer } from '../server.js';

type OpenApiDoc = {
  paths: Record<
    string,
    {
      get?: {
        parameters?: unknown[];
        responses?: Record<string, unknown>;
      };
    }
  >;
};

function getResponseEntry(doc: OpenApiDoc, path: string, statusCode: string) {
  const response = doc.paths[path]?.get?.responses?.[statusCode] as
    | {
        content?: {
          'application/json'?: {
            schema?: { example?: unknown; examples?: unknown[] };
            example?: unknown;
            examples?: Record<string, unknown>;
          };
        };
      }
    | undefined;
  return response?.content?.['application/json'];
}

function expectSchemaExamplesPresent(doc: OpenApiDoc, path: string, statusCode: string) {
  const entry = getResponseEntry(doc, path, statusCode);
  const schemaExamples = entry?.schema?.examples ?? [];
  const hasSchemaExample = entry?.schema?.example !== undefined;
  const hasMediaExample = entry?.example !== undefined;
  const mediaExamples = Object.keys(entry?.examples ?? {});
  expect(entry, `missing response schema for ${path} ${statusCode}`).toBeDefined();
  expect(
    schemaExamples.length > 0 || hasSchemaExample || hasMediaExample || mediaExamples.length > 0,
    `missing examples for ${path} ${statusCode}`,
  ).toBe(true);
}

function getQueryParameter(doc: OpenApiDoc, path: string, name: string) {
  const parameters = doc.paths[path]?.get?.parameters as
    | Array<{
        in?: string;
        name?: string;
        example?: unknown;
        examples?: Record<string, { value?: unknown }>;
        description?: string;
        schema?: { description?: string; example?: unknown; examples?: unknown[] };
      }>
    | undefined;
  return parameters?.find((parameter) => parameter.in === 'query' && parameter.name === name);
}

function hasCsvDocs(parameter: {
  description?: string;
  schema?: { description?: string; examples?: unknown[] };
}): boolean {
  const description =
    `${parameter.description ?? ''} ${parameter.schema?.description ?? ''}`.trim();
  const hasCsvHint = /\bcsv\b|comma[- ]separated/i.test(description);
  const schemaExamples = parameter.schema?.examples ?? [];
  const hasCsvExample = schemaExamples.some(
    (value) => typeof value === 'string' && value.includes(','),
  );
  return hasCsvHint || hasCsvExample;
}

function querySchemaExamples(parameter: {
  example?: unknown;
  examples?: Record<string, { value?: unknown }>;
  schema?: { example?: unknown; examples?: unknown[] };
}) {
  const examples = [...(parameter.schema?.examples ?? [])];
  if (parameter.schema?.example !== undefined) {
    examples.push(parameter.schema.example);
  }
  for (const example of Object.values(parameter.examples ?? {})) {
    if (example.value !== undefined) {
      examples.push(example.value);
    }
  }
  if (parameter.example !== undefined) {
    examples.push(parameter.example);
  }
  return examples;
}

describe('openapi', () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let dbPath: string;

  beforeAll(async () => {
    const res = await makeAppAndSeed();
    app = res.app;
    dbPath = res.dbPath;
  });

  afterAll(async () => {
    await app.close();
    cleanupDuckDbFiles(dbPath);
  });

  it('GET /docs/json returns an OpenAPI document', async () => {
    const res = await app.inject({ method: 'GET', url: '/docs/json' });

    expect(res.statusCode).toBe(200);

    const body = res.json() as OpenApiDoc & {
      openapi: string;
      info: { title: string };
      paths: Record<string, unknown>;
    };

    // minimal assertions (avoid brittleness)
    expect(body).toMatchObject({
      openapi: expect.any(String),
      info: {
        title: API_NAME,
      },
      paths: expect.any(Object),
    });

    // sanity: the routes we care about exist in the spec
    expect(body.paths).toHaveProperty('/health');
    expect(body.paths).toHaveProperty('/v1/timeseries');
    expect(body.paths).toHaveProperty('/v1/areas');
    expect(body.paths).toHaveProperty('/v1/categories');
    expect(body.paths).toHaveProperty('/v1/ranking');
    expect(body.paths).toHaveProperty('/v1/indicators');
    expect(body.paths).toHaveProperty('/v1/indicators/{indicator}');
    expect(body.paths).toHaveProperty('/v1/years');
    expect(body.paths).toHaveProperty('/v1/years/{year}');
    expect(body.paths).toHaveProperty('/v1/area-types');
    expect(body.paths).not.toHaveProperty('/metrics');

    expect(body.paths['/v1/timeseries']?.get?.responses).toHaveProperty('429');
    expect(body.paths['/v1/ranking']?.get?.responses).toHaveProperty('429');
    expect(body.paths['/v1/categories']?.get?.responses).toHaveProperty('400');

    // examples: every core endpoint has at least one success and one error example
    expectSchemaExamplesPresent(body, '/health', '200');
    expectSchemaExamplesPresent(body, '/health', '503');
    expectSchemaExamplesPresent(body, '/v1/timeseries', '200');
    expectSchemaExamplesPresent(body, '/v1/timeseries', '400');
    expectSchemaExamplesPresent(body, '/v1/areas', '200');
    expectSchemaExamplesPresent(body, '/v1/areas', '400');
    expectSchemaExamplesPresent(body, '/v1/categories', '200');
    expectSchemaExamplesPresent(body, '/v1/categories', '400');
    expectSchemaExamplesPresent(body, '/v1/ranking', '200');
    expectSchemaExamplesPresent(body, '/v1/ranking', '429');
    expectSchemaExamplesPresent(body, '/v1/indicators', '200');
    expectSchemaExamplesPresent(body, '/v1/indicators', '400');
    expectSchemaExamplesPresent(body, '/v1/indicators/{indicator}', '200');
    expectSchemaExamplesPresent(body, '/v1/indicators/{indicator}', '404');
    expectSchemaExamplesPresent(body, '/v1/years', '200');
    expectSchemaExamplesPresent(body, '/v1/years', '400');
    expectSchemaExamplesPresent(body, '/v1/years/{year}', '200');
    expectSchemaExamplesPresent(body, '/v1/years/{year}', '404');
    expectSchemaExamplesPresent(body, '/v1/area-types', '200');
    expectSchemaExamplesPresent(body, '/v1/area-types', '400');

    // CSV docs: area/category on timeseries and ranking provide description and/or examples
    const timeseriesArea = getQueryParameter(body, '/v1/timeseries', 'area');
    const timeseriesCategory = getQueryParameter(body, '/v1/timeseries', 'category');
    const rankingArea = getQueryParameter(body, '/v1/ranking', 'area');
    const rankingCategory = getQueryParameter(body, '/v1/ranking', 'category');

    expect(timeseriesArea).toBeDefined();
    expect(timeseriesCategory).toBeDefined();
    expect(rankingArea).toBeDefined();
    expect(rankingCategory).toBeDefined();

    expect(hasCsvDocs(timeseriesArea!)).toBe(true);
    expect(hasCsvDocs(timeseriesCategory!)).toBe(true);
    expect(hasCsvDocs(rankingArea!)).toBe(true);
    expect(hasCsvDocs(rankingCategory!)).toBe(true);

    // /v1/areas query examples: population/district/total and gender variant
    const areasIndicator = getQueryParameter(body, '/v1/areas', 'indicator');
    const areasAreaType = getQueryParameter(body, '/v1/areas', 'areaType');
    const areasCategory = getQueryParameter(body, '/v1/areas', 'category');

    expect(areasIndicator).toBeDefined();
    expect(areasAreaType).toBeDefined();
    expect(areasCategory).toBeDefined();

    const indicatorExamples = querySchemaExamples(areasIndicator!);
    const areaTypeExamples = querySchemaExamples(areasAreaType!);
    const categoryExamples = querySchemaExamples(areasCategory!);

    expect(indicatorExamples).toEqual(expect.arrayContaining(['population', 'gender']));
    expect(areaTypeExamples).toEqual(expect.arrayContaining(['district']));
    expect(categoryExamples).toEqual(expect.arrayContaining(['total']));
  });
});
