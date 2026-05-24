import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync } from 'fs';
import { join, dirname, relative, resolve, basename } from 'path';
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

  let deps = {};
  try {
    deps = JSON.parse(readFileSync(join(__dirname, 'src', 'dependencies.json'), 'utf-8'));
  } catch (e) {
    console.error('Could not read dependencies.json:', e);
  }

  const downloaded = {};
  for (const [name, url] of Object.entries(deps)) {
    try {
      const code = await download(url);
      downloaded[name] = code;
      console.log(`Downloaded ${name} (${(code.length / 1024).toFixed(0)} KB)`);
    } catch (e) {
      console.warn(`Could not download ${name}, will load at runtime:`, e.message);
    }
  }

  let gifJsCode = downloaded['gif.js'] || '';
  if (gifJsCode) {
    gifJsCode = gifJsCode.replace(
      /\.getContext\(\s*(['"])2d\1\s*\)/g,
      '.getContext("2d",{willReadFrequently:true})'
    );
  }

  let gifWorkerCode = downloaded['gif.worker.js'] || '';
  if (gifWorkerCode) {
    gifWorkerCode = gifWorkerCode.replace(/\/\/[#@]\s*sourceMappingURL=.*$/gm, '');
  }

  const workerDecl = gifWorkerCode
    ? `var __gifWorkerCode = ${JSON.stringify(gifWorkerCode)};`
    : '';

  let upngCode = downloaded['UPNG.js'] || '';
  let pakoCode = downloaded['pako'] || '';
  if (upngCode && pakoCode) {
    upngCode = pakoCode + '\n' + upngCode;
  }

  const libCodes = [
    downloaded['gifler'] || '',
    gifJsCode,
    downloaded['jszip'] || '',
    upngCode,
    workerDecl
  ].filter(Boolean);

  // Auto-discover and inline locale JSON files
  const localesDir = join(__dirname, 'src', 'locales');
  const localesObj = {};
  if (existsSync(localesDir)) {
    const localeFiles = readdirSync(localesDir).filter(f => f.endsWith('.json'));
    for (const file of localeFiles) {
      const code = basename(file, '.json');
      try {
        const data = JSON.parse(readFileSync(join(localesDir, file), 'utf-8'));
        localesObj[code] = data;
        console.log(`Locale: ${code} (${data.meta?.nativeName || data.meta?.name || code})`);
      } catch (e) {
        console.warn(`Could not parse locale ${file}:`, e.message);
      }
    }
  }
  const localesDecl = `var __locales = ${JSON.stringify(localesObj)};`;

  // Assemble: libraries first, then app code
  libCodes.push(localesDecl);
  const libs = libCodes.join('\n');
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

  // Copy PWA assets
  const srcDir = join(__dirname, 'src');
  ['manifest.json', 'sw.js', 'favicon.ico'].forEach(file => {
    const srcPath = join(srcDir, file);
    if (existsSync(srcPath)) {
      copyFileSync(srcPath, join(distDir, file));
    }
  });

  console.log(`Built ${(outputHtml.length / 1024).toFixed(0)} KB → dist/index.html`);
}

build().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
