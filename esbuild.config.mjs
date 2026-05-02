import * as esbuild from 'esbuild';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isServe = process.argv.includes('--serve');

const pluginJson = JSON.parse(readFileSync(resolve(__dirname, 'plugin.json'), 'utf8'));

const buildOptions = {
  entryPoints: [resolve(__dirname, 'src/main.ts')],
  bundle: true,
  minify: !isServe,
  format: 'iife',
  target: ['es2018'],
  outfile: resolve(__dirname, 'main.js'),
  loader: {
    '.json': 'json',
    '.ts': 'ts',
  },
  define: {
    'process.env.NODE_ENV': isServe ? '"development"' : '"production"',
  },
};

async function createZip() {
  const zip = new JSZip();
  
  const files = [
    'plugin.json',
    'main.js',
    'readme.md',
    'icon.png',
  ];

  for (const file of files) {
    const filePath = resolve(__dirname, file);
    if (existsSync(filePath)) {
      zip.file(file, readFileSync(filePath));
    }
  }

  const content = await zip.generateAsync({ type: 'nodebuffer' });
  writeFileSync(resolve(__dirname, 'dist.zip'), content);
  console.log('Created dist.zip');
}

async function build() {
  try {
    if (isServe) {
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      console.log('Watching for changes...');
      
      await createZip();
      
      const { host, port } = await ctx.serve({
        servedir: __dirname,
        port: 3000,
      });
      console.log(`Server running at http://${host}:${port}`);
    } else {
      await esbuild.build(buildOptions);
      await createZip();
      console.log('Build completed!');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();