const fs = require('fs');
const path = require('path');

const frontendRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(frontendRoot, 'src');
const publicRoot = path.join(frontendRoot, 'public');
const targetRoot = path.join(publicRoot, 'src');

if (!fs.existsSync(sourceRoot)) {
    throw new Error(`Source directory not found: ${sourceRoot}`);
}

if (!targetRoot.startsWith(publicRoot)) {
    throw new Error(`Refusing to sync outside public directory: ${targetRoot}`);
}

fs.rmSync(targetRoot, { recursive: true, force: true });
fs.mkdirSync(publicRoot, { recursive: true });
fs.cpSync(sourceRoot, targetRoot, { recursive: true });

console.log(`Synchronized ${sourceRoot} -> ${targetRoot}`);
