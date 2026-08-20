/**
 * Levanta backend + frontend con un solo comando y en una sola ventana.
 *
 *   npm run dev:all
 *
 * Escrito con spawn directo de node (sin shell) para que funcione igual en
 * Windows, macOS y Linux.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const processes = [
  { name: 'api ', color: '[35m', args: [join(root, 'server', 'bin', 'start.mjs')] },
  {
    name: 'web ',
    color: '[36m',
    args: [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '0.0.0.0'],
  },
];

const children = processes.map(({ name, color, args }) => {
  const child = spawn(process.execPath, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  const prefix = `${color}${name}[0m │ `;
  const pipe = (stream, target) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) target.write(`${prefix}${line}\n`);
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    process.stdout.write(`${prefix}proceso terminado (${code})\n`);
    shutdown();
  });
  return child;
});

let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(0), 300);
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, shutdown);
