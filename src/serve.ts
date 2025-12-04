/**
 * Simple dev server for the web viewer
 */

import { serve, file } from 'bun';
import { join } from 'path';

const PORT = 3000;
const WEB_DIR = join(import.meta.dir, '../web');
const OUTPUT_DIR = join(import.meta.dir, '../output');

// Determine which database to serve
const dbFile = process.argv[2] || 'index-10k.db';
const dbPath = join(OUTPUT_DIR, dbFile);

console.log(`Serving web viewer on http://localhost:${PORT}`);
console.log(`Database: ${dbPath}`);

serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname;

    // Default to index.html
    if (path === '/') path = '/index.html';

    // Serve database file
    if (path === '/index.db') {
      const dbFile = file(dbPath);
      if (await dbFile.exists()) {
        return new Response(dbFile, {
          headers: { 'Content-Type': 'application/octet-stream' }
        });
      }
      return new Response('Database not found', { status: 404 });
    }

    // Serve static files from web directory
    const filePath = join(WEB_DIR, path);
    const staticFile = file(filePath);

    if (await staticFile.exists()) {
      const ext = path.split('.').pop();
      const contentTypes: Record<string, string> = {
        'html': 'text/html',
        'js': 'application/javascript',
        'css': 'text/css',
        'json': 'application/json'
      };

      return new Response(staticFile, {
        headers: { 'Content-Type': contentTypes[ext!] || 'text/plain' }
      });
    }

    return new Response('Not found', { status: 404 });
  }
});
