const fs = require('fs');
const path = require('path');

// This script generates the published mirror used by static hosting.
// Keep it one-way: src/ is the source of truth, public/src/ is generated output.
const frontendRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(frontendRoot, 'src');
const publicRoot = path.join(frontendRoot, 'public');
const targetRoot = path.join(publicRoot, 'src');

const assertDirectoryExists = (directory, label) => {
    if (!fs.existsSync(directory)) {
        throw new Error(`${label} directory not found: ${directory}`);
    }
};

const rebuildPublicMirror = () => {
    fs.rmSync(targetRoot, { recursive: true, force: true });
    fs.mkdirSync(publicRoot, { recursive: true });
    fs.cpSync(sourceRoot, targetRoot, { recursive: true });
};

assertDirectoryExists(sourceRoot, 'Source');

if (!targetRoot.startsWith(publicRoot)) {
    throw new Error(`Refusing to generate outside public directory: ${targetRoot}`);
}

rebuildPublicMirror();

console.log(`Generated public/src mirror from ${sourceRoot} to ${targetRoot}. Do not edit files under public/src manually.`);
