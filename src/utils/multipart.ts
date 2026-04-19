/**
 * Simple multipart/form-data parser for file uploads
 */
import http from 'http';

export interface ParsedFile {
  name: string;
  content: Buffer;
  mimeType: string;
}

export interface ParseResult {
  fields: Record<string, string>;
  files: ParsedFile[];
}

export function parseMultipart(req: http.IncomingMessage): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || '';

    if (!contentType.includes('multipart/form-data')) {
      reject(new Error('Not a multipart request'));
      return;
    }

    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
    if (!boundaryMatch) {
      reject(new Error('No boundary found'));
      return;
    }
    const boundary = boundaryMatch[1] || boundaryMatch[2];

    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks);
        const result = parseMultipartBody(body, boundary);
        resolve(result);
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function parseMultipartBody(body: Buffer, boundary: string): ParseResult {
  const fields: Record<string, string> = {};
  const files: ParsedFile[] = [];

  const boundaryBuffer = Buffer.from('--' + boundary);
  const endBoundary = Buffer.from('--' + boundary + '--');

  let pos = 0;

  while (pos < body.length) {
    const boundaryIdx = indexOf(body, boundaryBuffer, pos);
    if (boundaryIdx === -1) break;

    // Skip CRLF after boundary
    let headerStart = boundaryIdx + boundaryBuffer.length;
    if (body[headerStart] === 0x0D) headerStart++; // \r
    if (body[headerStart] === 0x0A) headerStart++; // \n

    const nextBoundary = indexOf(body, boundaryBuffer, headerStart);
    if (nextBoundary === -1) break;

    const partEnd = nextBoundary - 2; // Skip CRLF before next boundary
    const partData = body.slice(headerStart, partEnd);

    // Parse headers
    const headerEnd = indexOf(partData, Buffer.from('\r\n\r\n'), 0);
    if (headerEnd === -1) {
      pos = nextBoundary + boundaryBuffer.length;
      continue;
    }

    const headerStr = partData.slice(0, headerEnd).toString('utf-8');
    const content = partData.slice(headerEnd + 4);

    // Parse Content-Disposition
    const dispositionMatch = headerStr.match(/Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]+)")?/i);
    if (!dispositionMatch) {
      pos = nextBoundary + boundaryBuffer.length;
      continue;
    }

    const fieldName = dispositionMatch[1];
    const fileName = dispositionMatch[2];

    // Parse Content-Type if present
    const contentTypeMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);
    const mimeType = contentTypeMatch ? contentTypeMatch[1] : 'application/octet-stream';

    if (fileName) {
      // File field
      files.push({ name: fileName, content, mimeType });
    } else {
      // Regular field
      fields[fieldName] = content.toString('utf-8');
    }

    pos = nextBoundary + boundaryBuffer.length;
  }

  return { fields, files };
}

function indexOf(buf: Buffer, needle: Buffer, start: number): number {
  for (let i = start; i <= buf.length - needle.length; i++) {
    let found = true;
    for (let j = 0; j < needle.length; j++) {
      if (buf[i + j] !== needle[j]) {
        found = false;
        break;
      }
    }
    if (found) return i;
  }
  return -1;
}
