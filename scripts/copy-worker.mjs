import fs from 'node:fs';
import path from 'node:path';

const targetDir = path.resolve('dist-electron');
const sourceFile = path.resolve('src/main/workers/camoufoxWorker.mjs');
const targetFile = path.resolve('dist-electron/camoufoxWorker.mjs');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

fs.copyFileSync(sourceFile, targetFile);
console.log('Worker copied successfully to dist-electron/camoufoxWorker.mjs');
