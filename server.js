const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Mock API responses for local development
const MOCK_API = {
  '/.auth/me': {
    clientPrincipal: {
      userId: 'dev-user-123',
      userDetails: 'atheodossiou@example.com',
      identityProvider: 'aad',
      userRoles: ['authenticated', 'anonymous']
    }
  },
  '/api/CheckAdmin': { isAdmin: true },
  '/api/GetUserSettings': { inputMode: 'percent' },
  '/api/GetAdmins': { admins: ['atheodossiou@example.com'] },
  '/api/GetAllTimeAllocations': [],
  '/api/GetAllUsersTimesheets': [],
  '/api/GetProjectAnalytics': { projects: [], summary: {} },
  '/api/GetProjectBudgets': [],
};

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0]; // Strip query params

  // Handle mock API endpoints
  if (MOCK_API[urlPath] !== undefined) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(MOCK_API[urlPath]));
    return;
  }

  // Handle mock POST endpoints
  if (urlPath.startsWith('/api/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // Handle the root URL
  let filePath = req.url === '/' ? './index.html' : '.' + req.url;

  // Get the file extension
  const extname = path.extname(filePath);
  let contentType = MIME_TYPES[extname] || 'application/octet-stream';

  // Read the file
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // Page not found
        fs.readFile('./index.html', (err, data) => {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(data, 'utf-8');
        });
      } else {
        // Server error
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      // Success
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`Press Ctrl+C to stop the server`);
}); 