import { defineConfig } from 'vitest/config';

/**
 * node:sqlite es mas nuevo que la lista de modulos internos que conoce esta
 * version de Vite, que intenta resolverlo como un paquete y falla. Este plugin
 * le dice que lo deje en paz: es de Node.
 */
const externalNodeSqlite = {
  name: 'playzone-external-node-sqlite',
  enforce: 'pre' as const,
  resolveId(id: string) {
    if (id === 'node:sqlite' || id === 'sqlite') return { id: 'node:sqlite', external: true };
    return null;
  },
};

export default defineConfig({
  plugins: [externalNodeSqlite],
  // Mismo nombre que inyecta vite.config.ts en la build real; aqui basta un
  // valor fijo para poder comparar "igual" / "distinto" en los tests.
  define: {
    __BUILD_ID__: JSON.stringify('test-build'),
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'server/test/**/*.test.mjs'],
    reporters: 'default',
  },
});
