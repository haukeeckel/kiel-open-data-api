export const NODE_ENVS = ['development', 'test', 'production'] as const;
export type NodeEnv = (typeof NODE_ENVS)[number];

export const DEFAULT_NODE_ENV: NodeEnv = 'development';
export const DEFAULT_PORT = 3000;
export const DEFAULT_HOST = '0.0.0.0';
