import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const port = Number(process.env.PEEKAPIX_FIXTURE_PORT || 4173);
const files = new Map([
  ['/', ['index.html', 'text/html']],
  ['/frame.html', ['frame.html', 'text/html']],
  ['/fixture.css', ['fixture.css', 'text/css']],
  ['/fixture.js', ['fixture.js', 'text/javascript']],
]);

createServer(async (request, response) => {
  const file = files.get(new URL(request.url, 'http://localhost').pathname);
  if (!file) {
    response.writeHead(404).end();
    return;
  }
  const [name, type] = file;
  const content = await readFile(new URL('../fixtures/' + name, import.meta.url));
  response.writeHead(200, {
    'Content-Type': type + '; charset=utf-8',
    'Content-Security-Policy': "default-src 'self'; style-src 'self'; frame-src 'self'; object-src 'none'",
  }).end(content);
}).listen(port, '127.0.0.1', () => console.log('Peekapix fixtures · http://127.0.0.1:' + port));
