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
      userDetails: 'atheodossiou@energyrecovery.com',
      identityProvider: 'aad',
      userRoles: ['authenticated', 'anonymous'],
      claims: [
        { typ: 'name', val: 'Alexandros Theodossiou' },
        { typ: 'preferred_username', val: 'atheodossiou@energyrecovery.com' }
      ]
    }
  },
  '/api/CheckAdmin': { isAdmin: true },
  '/api/GetUserSettings': { defaultInputMode: 'percent' },
  '/api/GetUsers': [
    { userId: 'dev-user-123', email: 'atheodossiou@energyrecovery.com', displayName: 'Alexandros Theodossiou', isAdmin: true, defaultInputMode: 'percent', firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString() },
    { userId: 'user-jsmith', email: 'jsmith@energyrecovery.com', displayName: 'John Smith', isAdmin: false, defaultInputMode: 'percent', firstSeen: '2025-06-01T00:00:00Z', lastSeen: '2026-02-10T00:00:00Z' },
    { userId: 'user-klee', email: 'klee@energyrecovery.com', displayName: 'Karen Lee', isAdmin: false, defaultInputMode: 'hours', firstSeen: '2025-08-15T00:00:00Z', lastSeen: '2026-02-12T00:00:00Z' }
  ],
  '/api/GetProjects': [
    { id: 'CP000022', name: 'General R&D Infrastructure', color: '#3498DB', isActive: true, budgetQ1: 0, budgetQ2: 0, budgetQ3: 0, budgetQ4: 0, isDefault: false, defaultPercentage: 0 },
    { id: 'CP000038', name: 'Skid Changeover Costs', color: '#E74C3C', isActive: true, budgetQ1: 0, budgetQ2: 0, budgetQ3: 0, budgetQ4: 0, isDefault: false, defaultPercentage: 0 },
    { id: 'CP000039', name: 'Unapplied Engineering Time', color: '#2ECC71', isActive: true, budgetQ1: 0, budgetQ2: 0, budgetQ3: 0, budgetQ4: 0, isDefault: true, defaultPercentage: 15 },
    { id: 'DD000200', name: 'Water Default Project Code', color: '#3498DB', isActive: true, budgetQ1: 0, budgetQ2: 0, budgetQ3: 0, budgetQ4: 0, isDefault: false, defaultPercentage: 0 },
    { id: 'DD000210', name: 'Waste Water Default Project Code', color: '#2C3E50', isActive: true, budgetQ1: 0, budgetQ2: 0, budgetQ3: 0, budgetQ4: 0, isDefault: false, defaultPercentage: 0 },
    { id: 'GE000001', name: 'Time Off / Holiday', color: '#95A5A6', isActive: true, budgetQ1: 0, budgetQ2: 0, budgetQ3: 0, budgetQ4: 0, isDefault: false, defaultPercentage: 0 },
    { id: 'MS000002', name: 'NPI ST PX Series', color: '#9B59B6', isActive: true, budgetQ1: 0, budgetQ2: 0, budgetQ3: 0, budgetQ4: 0, isDefault: false, defaultPercentage: 0 },
    { id: 'PE000005', name: 'ENG MFG Support', color: '#F1C40F', isActive: true, budgetQ1: 0, budgetQ2: 0, budgetQ3: 0, budgetQ4: 0, isDefault: false, defaultPercentage: 0 },
    { id: 'RD000026', name: 'Sage Geosystems', color: '#1ABC9C', isActive: true, budgetQ1: 0, budgetQ2: 0, budgetQ3: 0, budgetQ4: 0, isDefault: false, defaultPercentage: 0 },
    { id: 'RD000027', name: 'Skunkworks', color: '#E67E22', isActive: true, budgetQ1: 0, budgetQ2: 0, budgetQ3: 0, budgetQ4: 0, isDefault: false, defaultPercentage: 0 },
    { id: 'RD000042', name: 'PX G 1300 Product Support', color: '#34495E', isActive: true, budgetQ1: 0, budgetQ2: 0, budgetQ3: 0, budgetQ4: 0, isDefault: false, defaultPercentage: 0 },
    { id: 'RD000048', name: 'DOE - PXG for Heat Pump', color: '#8E44AD', isActive: true, budgetQ1: 0, budgetQ2: 0, budgetQ3: 0, budgetQ4: 0, isDefault: false, defaultPercentage: 0 },
    { id: 'RD000049', name: 'PXG V2.5 Integration', color: '#E91E63', isActive: true, budgetQ1: 0, budgetQ2: 0, budgetQ3: 0, budgetQ4: 0, isDefault: false, defaultPercentage: 0 },
    { id: 'RD000050', name: 'Eductor', color: '#5D6D7E', isActive: true, budgetQ1: 0, budgetQ2: 0, budgetQ3: 0, budgetQ4: 0, isDefault: false, defaultPercentage: 0 },
    { id: 'RD000051', name: 'PX Lite', color: '#48C9B0', isActive: true, budgetQ1: 0, budgetQ2: 0, budgetQ3: 0, budgetQ4: 0, isDefault: false, defaultPercentage: 0 },
    { id: 'VQ000003', name: 'R&D Technology Pipeline', color: '#AF7AC5', isActive: true, budgetQ1: 0, budgetQ2: 0, budgetQ3: 0, budgetQ4: 0, isDefault: false, defaultPercentage: 0 },
    { id: 'VQ000008', name: 'Water Sales Support', color: '#27AE60', isActive: true, budgetQ1: 0, budgetQ2: 0, budgetQ3: 0, budgetQ4: 0, isDefault: false, defaultPercentage: 0 },
    { id: 'VQ000009', name: 'PX, Turbo, Pump, Support', color: '#F39C12', isActive: true, budgetQ1: 0, budgetQ2: 0, budgetQ3: 0, budgetQ4: 0, isDefault: false, defaultPercentage: 0 },
    { id: 'VQ000010', name: 'PX Part Reduction, PX Cost Reduction', color: '#2980B9', isActive: true, budgetQ1: 0, budgetQ2: 0, budgetQ3: 0, budgetQ4: 0, isDefault: false, defaultPercentage: 0 },
    { id: 'VQ000011', name: 'HP pump improvements', color: '#C0392B', isActive: true, budgetQ1: 0, budgetQ2: 0, budgetQ3: 0, budgetQ4: 0, isDefault: false, defaultPercentage: 0 },
    { id: 'VQ000012', name: 'ICAR/ Product Improvements', color: '#7F8C8D', isActive: true, budgetQ1: 0, budgetQ2: 0, budgetQ3: 0, budgetQ4: 0, isDefault: false, defaultPercentage: 0 },
    { id: 'VQ000013', name: 'Project Eagle', color: '#D2B4DE', isActive: true, budgetQ1: 0, budgetQ2: 0, budgetQ3: 0, budgetQ4: 0, isDefault: false, defaultPercentage: 0 },
    { id: 'VQ000014', name: 'Project Falcon', color: '#8B4513', isActive: true, budgetQ1: 0, budgetQ2: 0, budgetQ3: 0, budgetQ4: 0, isDefault: false, defaultPercentage: 0 },
    { id: 'WI000004', name: 'Aquabold Improvements', color: '#3498DB', isActive: true, budgetQ1: 0, budgetQ2: 0, budgetQ3: 0, budgetQ4: 0, isDefault: false, defaultPercentage: 0 },
    { id: 'WI000007', name: 'PX Q400 COGS Reduction', color: '#A3E4D7', isActive: true, budgetQ1: 0, budgetQ2: 0, budgetQ3: 0, budgetQ4: 0, isDefault: false, defaultPercentage: 0 },
    { id: 'WI000009', name: 'Turbo Std 550 and 875', color: '#F9E79F', isActive: true, budgetQ1: 0, budgetQ2: 0, budgetQ3: 0, budgetQ4: 0, isDefault: false, defaultPercentage: 0 }
  ],
  '/api/GetAllTimeAllocations': [],
  '/api/GetAllUsersTimesheets': [
    {
      userId: 'dev-user-123',
      userEmail: 'atheodossiou@energyrecovery.com',
      displayName: 'Alexandros Theodossiou',
      weeks: {
        '2/10/2026 - 2/16/2026': [
          { projectId: 'CP000039', projectName: 'Unapplied Engineering Time', percentage: 15, hours: 6 },
          { projectId: 'CP000022', projectName: 'General R&D Infrastructure', percentage: 50, hours: 20 },
          { projectId: 'RD000027', projectName: 'Skunkworks', percentage: 35, hours: 14 }
        ],
        '2/3/2026 - 2/9/2026': [
          { projectId: 'CP000039', projectName: 'Unapplied Engineering Time', percentage: 20, hours: 8 },
          { projectId: 'PE000005', projectName: 'ENG MFG Support', percentage: 80, hours: 32 }
        ]
      }
    },
    {
      userId: 'user-jsmith',
      userEmail: 'jsmith@energyrecovery.com',
      displayName: 'John Smith',
      weeks: {
        '2/10/2026 - 2/16/2026': [
          { projectId: 'RD000049', projectName: 'PXG V2.5 Integration', percentage: 60, hours: 24 },
          { projectId: 'RD000050', projectName: 'Eductor', percentage: 40, hours: 16 }
        ]
      }
    }
  ],
  '/api/GetProjectAnalytics': [
    {
      projectId: 'RD000049', projectName: 'PXG V2.5 Integration',
      budgetHours: 480, actualHours: 620, budgetQ1: 2, budgetQ2: 2, budgetQ3: 1, budgetQ4: 1,
      isOverBudget: true, overBy: 140,
      userBreakdown: [
        { userEmail: 'atheodossiou@energyrecovery.com', displayName: 'Alexandros Theodossiou', totalHours: 320 },
        { userEmail: 'jsmith@energyrecovery.com', displayName: 'John Smith', totalHours: 200 },
        { userEmail: 'klee@energyrecovery.com', displayName: 'Karen Lee', totalHours: 100 }
      ]
    },
    {
      projectId: 'CP000022', projectName: 'General R&D Infrastructure',
      budgetHours: 800, actualHours: 540, budgetQ1: 3, budgetQ2: 3, budgetQ3: 2, budgetQ4: 2,
      isOverBudget: false, overBy: 0,
      userBreakdown: [
        { userEmail: 'atheodossiou@energyrecovery.com', displayName: 'Alexandros Theodossiou', totalHours: 200 },
        { userEmail: 'jsmith@energyrecovery.com', displayName: 'John Smith', totalHours: 180 },
        { userEmail: 'klee@energyrecovery.com', displayName: 'Karen Lee', totalHours: 160 }
      ]
    },
    {
      projectId: 'RD000050', projectName: 'Eductor',
      budgetHours: 320, actualHours: 280, budgetQ1: 1, budgetQ2: 1, budgetQ3: 1, budgetQ4: 1,
      isOverBudget: false, overBy: 0,
      userBreakdown: [
        { userEmail: 'jsmith@energyrecovery.com', displayName: 'John Smith', totalHours: 160 },
        { userEmail: 'klee@energyrecovery.com', displayName: 'Karen Lee', totalHours: 120 }
      ]
    },
    {
      projectId: 'VQ000013', projectName: 'Project Eagle',
      budgetHours: 200, actualHours: 250, budgetQ1: 0.5, budgetQ2: 0.5, budgetQ3: 0.5, budgetQ4: 0.5,
      isOverBudget: true, overBy: 50,
      userBreakdown: [
        { userEmail: 'atheodossiou@energyrecovery.com', displayName: 'Alexandros Theodossiou', totalHours: 150 },
        { userEmail: 'klee@energyrecovery.com', displayName: 'Karen Lee', totalHours: 100 }
      ]
    }
  ],
};

const server = http.createServer((req, res) => {
  const [urlPath, queryString] = req.url.split('?');
  const params = new URLSearchParams(queryString || '');

  // Handle mock API endpoints
  if (MOCK_API[urlPath] !== undefined) {
    let data = MOCK_API[urlPath];

    // Filter GetAllUsersTimesheets by userId if provided
    if (urlPath === '/api/GetAllUsersTimesheets' && params.get('userId')) {
      const userId = params.get('userId');
      data = data.filter(u => u.userId === userId);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }

  // Handle mock POST endpoints
  if (urlPath === '/api/PopulateDisplayNames') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, total: 3, populated: 2, skipped: 1, failed: 0, errors: [] }));
    return;
  }
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