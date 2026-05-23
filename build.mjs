import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { get } from 'https';
import { minify } from 'terser';

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

function download(url) {
  return new Promise((resolve, reject) => {
    get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        download(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: ${res.statusCode} for ${url}`));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function build() {
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

  let appCode = scriptParts.join('\n')
    .replace(/await\s+import\(['"][^'"]+['"]\)\.then\(m\s*=>\s*m\.(\w+)\(([^)]*)\)\)/g, (match, fnName, args) => {
      return `${fnName}(${args})`;
    })
    .replace(/const\s*\{\s*(\w+)\s*\}\s*=\s*await\s+import\(['"][^'"]+['"]\)/g, (match, name) => {
      return `// ${name} is already available (bundled)`;
    })
    .replace(/import\(['"][^'"]+['"]\)\.then\(m\s*=>\s*\{\s*((?:m\.\w+\([^)]*\);?\s*)+)\}\)/g, (match, body) => {
      return body.replace(/m\.(\w+)\(([^)]*)\)/g, '$1($2)');
    })
    .replace(/import\(['"][^'"]+['"]\)\.then\(m\s*=>\s*m\.(\w+)\(([^)]*)\)\)/g, (match, fnName, args) => {
      return `${fnName}(${args})`;
    })
    .replace(/typeof\s+__gifWorkerCode\s*!==?\s*['"]undefined['"]/g, 'true')
    .replace(/await\s+import\(['"][^'"]+['"]\)/g, 'undefined')
    .replace(/\n\s*\/\/\s*undefined is already available/g, '');

  let giflerCode = '';
  try {
    giflerCode = await download('https://cdn.jsdelivr.net/npm/gifler@0.1.0/gifler.min.js');
    console.log(`Downloaded gifler (${(giflerCode.length / 1024).toFixed(0)} KB)`);
  } catch (e) {
    console.warn('Could not download gifler, will load at runtime:', e.message);
  }

  let gifJsCode = '';
  try {
    gifJsCode = await download('https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.js');
    console.log(`Downloaded gif.js (${(gifJsCode.length / 1024).toFixed(0)} KB)`);
  } catch (e) {
    console.warn('Could not download gif.js, will load at runtime:', e.message);
  }

  let gifWorkerCode = '';
  try {
    gifWorkerCode = await download('https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js');
    console.log(`Downloaded gif.worker.js (${(gifWorkerCode.length / 1024).toFixed(0)} KB)`);
  } catch (e) {
    console.warn('Could not download gif.worker.js, will load at runtime:', e.message);
  }

  let jszipCode = '';
  try {
    jszipCode = await download('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
    console.log(`Downloaded jszip (${(jszipCode.length / 1024).toFixed(0)} KB)`);
  } catch (e) {
    console.warn('Could not download jszip, will load at runtime:', e.message);
  }

  // Build the worker code declaration so gif.js can create a blob URL offline
  const workerDecl = gifWorkerCode
    ? `var __gifWorkerCode = ${JSON.stringify(gifWorkerCode)};`
    : '';

  // Assemble: libraries first, then app code
  const libs = [giflerCode, gifJsCode, jszipCode, workerDecl].filter(Boolean).join('\n');
  let combinedScript = libs ? libs + '\n' + appCode : appCode;

  const result = await minify(combinedScript, {
    compress: { booleans: true, conditionals: true, sequences: true, unused: true },
    output: { comments: /@license|@preserve|@copyright|gifler\.js/i }
  });

  const outputHtml = html
    .replace(/<link rel="stylesheet" href="css\/styles\.css">/, `<style>\n${css}\n</style>`)
    .replace(/<script type="module" src="js\/app\.js"><\/script>/, '')
    + `<script>\n'use strict';\n${result.code}\n</script>\n`;

  const distDir = join(__dirname, 'dist');
  if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });
  writeFileSync(join(distDir, 'index.html'), outputHtml);

  console.log(`Built ${(outputHtml.length / 1024).toFixed(0)} KB → dist/index.html`);
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
