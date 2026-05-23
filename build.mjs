import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function read(fp) {
  return readFileSync(join(__dirname, fp), 'utf-8');
}

function walkJsFiles(dir) {
  const result = [];
  const entries = readdirSync(join(__dirname, dir), { withFileTypes: true });
  for (const entry of entries) {
    const full = dir + '/' + entry.name;
    if (entry.isDirectory()) result.push(...walkJsFiles(full));
    else if (entry.name.endsWith('.js')) result.push(full);
  }
  return result;
}

const jsFiles = walkJsFiles('src/js');

const imports = {};
for (const file of jsFiles) {
  const src = read(file);
  const deps = [];
  const importRegex = /import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(src)) !== null) {
    const resolved = resolve(join(__dirname, dirname(file)), match[1]);
    const rel = relative(__dirname, resolved).replace(/\\/g, '/');
    deps.push(rel);
  }
  imports[file.replace(/\\/g, '/')] = deps;
}

const sorted = [];
const visited = new Set();
const inStack = new Set();

function visit(node) {
  if (visited.has(node)) return;
  if (inStack.has(node)) {
    console.warn(`Circular dependency detected: ${node}`);
    return;
  }
  inStack.add(node);
  const deps = imports[node] || [];
  for (const dep of deps) {
    if (dep) visit(dep);
  }
  inStack.delete(node);
  visited.add(node);
  sorted.push(node);
}

for (const file of jsFiles) {
  visit(file.replace(/\\/g, '/'));
}

const css = read('src/css/styles.css');
const html = read('src/index.html');

function stripImportsExports(code) {
  return code
    .replace(/^import\s+.*?;?\s*$/gm, '')
    .replace(/^export\s+/gm, '')
    .replace(/^import\s*\{[^}]*\}\s*from\s*['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^import\s+\*\s+as\s+\w+\s+from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^import\s+\w+\s+from\s+['"][^'"]+['"];?\s*$/gm, '');
}

const scriptParts = sorted.map(file => {
  const src = read(file);
  return stripImportsExports(src);
});

const combinedScript = scriptParts
  .join('\n')
  .replace(/await\s+import\(['"][^'"]+['"]\)\.then\(m\s*=>\s*m\.(\w+)\(([^)]*)\)\)/g, (match, fnName, args) => {
    return `${fnName}(${args})`;
  })
  .replace(/const\s*\{\s*(\w+)\s*\}\s*=\s*await\s+import\(['"][^'"]+['"]\)/g, (match, name) => {
    return `// ${name} is already available (bundled)`;
  })
  .replace(/import\(['"][^'"]+['"]\)\.then\(m\s*=>\s*m\.(\w+)\(([^)]*)\)\)/g, (match, fnName, args) => {
    return `${fnName}(${args})`;
  })
  .replace(/await\s+import\(['"][^'"]+['"]\)/g, 'undefined')
  .replace(/\n\s*\/\/\s*undefined is already available/g, '');

const outputHtml = html
  .replace(/<link rel="stylesheet" href="css\/styles\.css">/, `<style>\n${css}\n</style>`)
  .replace(/<script type="module" src="js\/app\.js"><\/script>/, '')
  + `<script>\n'use strict';\n${combinedScript}\n</script>\n`;

const distDir = join(__dirname, 'dist');
if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });
writeFileSync(join(distDir, 'index.html'), outputHtml);

console.log(`Built ${(outputHtml.length / 1024).toFixed(0)} KB → dist/index.html`);
