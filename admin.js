// Admin Page Module
// Renders into #admin-container, managed via window.createAdminPage()

(function() {
  let adminData = {
    projects: [],
    users: [],
    usersTimesheets: [],
    activeTab: 'projects'
  };

  // Expose createAdminPage globally for index.js to call
  window.createAdminPage = createAdminPage;

  function createAdminPage() {
    const container = document.getElementById('admin-container');
    if (!container) return;

    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'max-w-4xl mx-auto p-4';

    // Card
    const card = document.createElement('div');
    card.className = 'bg-white rounded-lg shadow-lg overflow-hidden';

    // Header
    const header = document.createElement('div');
    header.className = 'p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b flex justify-between items-center';

    const title = document.createElement('h3');
    title.className = 'text-xl font-bold text-indigo-800';
    title.textContent = 'Admin Console';

    const backBtn = document.createElement('button');
    backBtn.className = 'px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700';
    backBtn.textContent = 'Back to Timesheet';
    backBtn.addEventListener('click', () => {
      container.classList.add('hidden');
      document.getElementById('weekly-tracker').classList.remove('hidden');
    });

    header.appendChild(title);
    header.appendChild(backBtn);
    card.appendChild(header);

    // Tabs
    const tabBar = document.createElement('div');
    tabBar.className = 'flex border-b';
    const tabs = [
      { id: 'projects', label: 'Projects' },
      { id: 'budgets', label: 'Budgets' },
      { id: 'users', label: 'Users' },
      { id: 'timesheets', label: 'User Timesheets' },
      { id: 'analytics', label: 'Analytics' }
    ];

    tabs.forEach(tab => {
      const tabBtn = document.createElement('button');
      tabBtn.className = 'px-4 py-3 text-sm font-medium border-b-2 ' + (
        adminData.activeTab === tab.id
          ? 'border-indigo-600 text-indigo-600'
          : 'border-transparent text-slate-500 hover:text-slate-700'
      );
      tabBtn.textContent = tab.label;
      tabBtn.addEventListener('click', () => {
        adminData.activeTab = tab.id;
        createAdminPage();
      });
      tabBar.appendChild(tabBtn);
    });
    card.appendChild(tabBar);

    // Content area
    const content = document.createElement('div');
    content.className = 'p-6';
    content.id = 'admin-content';
    card.appendChild(content);

    wrapper.appendChild(card);
    container.appendChild(wrapper);

    // Load data for active tab
    loadTabData(adminData.activeTab, content);
  }

  async function loadTabData(tab, contentEl) {
    contentEl.textContent = '';
    const loading = document.createElement('div');
    loading.className = 'text-center py-8 text-slate-400';
    loading.textContent = 'Loading...';
    contentEl.appendChild(loading);

    try {
      switch (tab) {
        case 'projects': await loadProjectsTab(contentEl); break;
        case 'budgets': await loadBudgetsTab(contentEl); break;
        case 'users': await loadUsersTab(contentEl); break;
        case 'timesheets': await loadTimesheetsTab(contentEl); break;
        case 'analytics': await loadAnalyticsTab(contentEl); break;
      }
    } catch (err) {
      contentEl.textContent = '';
      const errDiv = document.createElement('div');
      errDiv.className = 'text-center py-8 text-red-500';
      errDiv.textContent = 'Error loading data: ' + err.message;
      contentEl.appendChild(errDiv);
    }
  }

  // ====== PROJECTS TAB ======
  async function loadProjectsTab(contentEl) {
    const response = await fetch('/api/GetProjects?includeInactive=true');
    if (!response.ok) throw new Error('Failed to load projects');
    adminData.projects = await response.json();

    contentEl.textContent = '';

    // Add button
    const addBtn = document.createElement('button');
    addBtn.className = 'mb-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm';
    addBtn.textContent = '+ Add Project';
    addBtn.addEventListener('click', () => showProjectForm(contentEl, null));
    contentEl.appendChild(addBtn);

    // Table
    const table = document.createElement('table');
    table.className = 'w-full text-sm';

    // Table header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.className = 'border-b text-left text-slate-500';
    ['Color', 'ID', 'Name', 'Status', 'Actions'].forEach(text => {
      const th = document.createElement('th');
      th.className = 'py-2 px-2';
      th.textContent = text;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    adminData.projects.forEach(project => {
      const tr = document.createElement('tr');
      tr.className = 'border-b hover:bg-slate-50';

      const colorTd = document.createElement('td');
      colorTd.className = 'py-2 px-2';
      const dot = document.createElement('span');
      dot.className = 'inline-block w-4 h-4 rounded-full';
      dot.style.backgroundColor = project.color || '#808080';
      colorTd.appendChild(dot);

      const idTd = document.createElement('td');
      idTd.className = 'py-2 px-2 font-mono text-xs';
      idTd.textContent = project.id;

      const nameTd = document.createElement('td');
      nameTd.className = 'py-2 px-2';
      nameTd.textContent = project.name;

      const statusTd = document.createElement('td');
      statusTd.className = 'py-2 px-2';
      const badge = document.createElement('span');
      badge.className = project.isActive
        ? 'px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700'
        : 'px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700';
      badge.textContent = project.isActive ? 'Active' : 'Inactive';
      statusTd.appendChild(badge);

      const actionsTd = document.createElement('td');
      actionsTd.className = 'py-2 px-2';
      const editBtn = document.createElement('button');
      editBtn.className = 'text-indigo-600 hover:text-indigo-800 text-xs mr-2';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => showProjectForm(contentEl, project));

      const toggleBtn = document.createElement('button');
      toggleBtn.className = project.isActive
        ? 'text-red-500 hover:text-red-700 text-xs'
        : 'text-green-500 hover:text-green-700 text-xs';
      toggleBtn.textContent = project.isActive ? 'Deactivate' : 'Activate';
      toggleBtn.addEventListener('click', () => toggleProject(project, contentEl));

      actionsTd.appendChild(editBtn);
      actionsTd.appendChild(toggleBtn);

      tr.appendChild(colorTd);
      tr.appendChild(idTd);
      tr.appendChild(nameTd);
      tr.appendChild(statusTd);
      tr.appendChild(actionsTd);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    contentEl.appendChild(table);
  }

  function showProjectForm(contentEl, existingProject) {
    // Remove any existing form
    const existingForm = document.getElementById('admin-project-form');
    if (existingForm) existingForm.remove();

    const isEdit = !!existingProject;

    const form = document.createElement('div');
    form.id = 'admin-project-form';
    form.className = 'mb-4 p-4 border rounded-lg bg-slate-50';

    const formTitle = document.createElement('h4');
    formTitle.className = 'font-medium mb-3';
    formTitle.textContent = (isEdit ? 'Edit' : 'Add') + ' Project';
    form.appendChild(formTitle);

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 gap-3';

    // Project ID field
    const idGroup = document.createElement('div');
    const idLabel = document.createElement('label');
    idLabel.className = 'block text-xs text-slate-500 mb-1';
    idLabel.textContent = 'Project ID';
    const idInput = document.createElement('input');
    idInput.id = 'pf-id';
    idInput.type = 'text';
    idInput.className = 'w-full px-3 py-2 border rounded text-sm' + (isEdit ? ' bg-slate-200' : '');
    idInput.value = existingProject?.id || '';
    if (isEdit) idInput.readOnly = true;
    idGroup.appendChild(idLabel);
    idGroup.appendChild(idInput);
    grid.appendChild(idGroup);

    // Code field
    const codeGroup = document.createElement('div');
    const codeLabel = document.createElement('label');
    codeLabel.className = 'block text-xs text-slate-500 mb-1';
    codeLabel.textContent = 'Code';
    const codeInput = document.createElement('input');
    codeInput.id = 'pf-code';
    codeInput.type = 'text';
    codeInput.className = 'w-full px-3 py-2 border rounded text-sm';
    codeInput.value = existingProject?.code || '';
    codeGroup.appendChild(codeLabel);
    codeGroup.appendChild(codeInput);
    grid.appendChild(codeGroup);

    // Name field (full width)
    const nameGroup = document.createElement('div');
    nameGroup.className = 'col-span-2';
    const nameLabel = document.createElement('label');
    nameLabel.className = 'block text-xs text-slate-500 mb-1';
    nameLabel.textContent = 'Name';
    const nameInput = document.createElement('input');
    nameInput.id = 'pf-name';
    nameInput.type = 'text';
    nameInput.className = 'w-full px-3 py-2 border rounded text-sm';
    nameInput.value = existingProject?.name || '';
    nameGroup.appendChild(nameLabel);
    nameGroup.appendChild(nameInput);
    grid.appendChild(nameGroup);

    // Color field
    const colorGroup = document.createElement('div');
    const colorLabel = document.createElement('label');
    colorLabel.className = 'block text-xs text-slate-500 mb-1';
    colorLabel.textContent = 'Color';
    const colorInput = document.createElement('input');
    colorInput.id = 'pf-color';
    colorInput.type = 'color';
    colorInput.className = 'w-full h-10 border rounded';
    colorInput.value = existingProject?.color || '#808080';
    colorGroup.appendChild(colorLabel);
    colorGroup.appendChild(colorInput);
    grid.appendChild(colorGroup);

    form.appendChild(grid);

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.className = 'mt-3 flex gap-2';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700';
    saveBtn.textContent = 'Save';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'px-4 py-2 text-slate-600 hover:bg-slate-100 rounded text-sm';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => form.remove());

    btnRow.appendChild(saveBtn);
    btnRow.appendChild(cancelBtn);
    form.appendChild(btnRow);

    // Error area
    const errorEl = document.createElement('div');
    errorEl.className = 'mt-2 text-red-500 text-sm hidden';
    form.appendChild(errorEl);

    // Insert at top of content (after add button)
    contentEl.insertBefore(form, contentEl.children[1] || null);

    saveBtn.addEventListener('click', async () => {
      const id = idInput.value.trim();
      const code = codeInput.value.trim();
      const name = nameInput.value.trim();
      const color = colorInput.value;

      if (!id || !code || !name) {
        errorEl.textContent = 'All fields are required.';
        errorEl.classList.remove('hidden');
        return;
      }

      try {
        const resp = await fetch('/api/UpdateProject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: id, code, name, color, isActive: existingProject?.isActive !== false })
        });
        if (!resp.ok) throw new Error(await resp.text());
        form.remove();
        await loadProjectsTab(contentEl);
      } catch (err) {
        errorEl.textContent = err.message;
        errorEl.classList.remove('hidden');
      }
    });
  }

  async function toggleProject(project, contentEl) {
    try {
      const resp = await fetch('/api/UpdateProject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: project.id,
          code: project.code,
          name: project.name,
          color: project.color,
          isActive: !project.isActive
        })
      });
      if (!resp.ok) throw new Error(await resp.text());
      await loadProjectsTab(contentEl);
    } catch (err) {
      console.error('Error toggling project:', err);
    }
  }

  // ====== BUDGETS TAB ======
  async function loadBudgetsTab(contentEl) {
    const response = await fetch('/api/GetProjects?includeInactive=true');
    if (!response.ok) throw new Error('Failed to load projects');
    const projectsList = await response.json();

    contentEl.textContent = '';

    // Description
    const desc = document.createElement('p');
    desc.className = 'text-sm text-slate-500 mb-4';
    desc.textContent = 'Set FTE (Full-Time Engineer) budget per quarter. 1 FTE = 40 hrs/week.';
    contentEl.appendChild(desc);

    const table = document.createElement('table');
    table.className = 'w-full text-sm';

    // Table header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.className = 'border-b text-left text-slate-500';
    ['Project', 'Q1', 'Q2', 'Q3', 'Q4', 'Total FTE', ''].forEach(text => {
      const th = document.createElement('th');
      th.className = 'py-2 px-2' + (text !== 'Project' && text !== '' ? ' text-center' : '');
      th.textContent = text;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    projectsList.filter(p => p.isActive).forEach(project => {
      const tr = document.createElement('tr');
      tr.className = 'border-b hover:bg-slate-50';

      const nameTd = document.createElement('td');
      nameTd.className = 'py-2 px-2';
      nameTd.textContent = project.name;
      tr.appendChild(nameTd);

      // Q1-Q4 inputs
      const inputs = {};
      ['Q1', 'Q2', 'Q3', 'Q4'].forEach(q => {
        const td = document.createElement('td');
        td.className = 'py-2 px-1 text-center';
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.step = '0.1';
        input.className = 'w-16 px-1 py-1 border rounded text-sm text-center';
        input.value = project['budget' + q] || '';
        input.placeholder = '0';
        inputs[q] = input;
        td.appendChild(input);
        tr.appendChild(td);
      });

      // Total FTE (read-only computed)
      const totalTd = document.createElement('td');
      totalTd.className = 'py-2 px-2 text-center font-medium';
      const updateTotal = () => {
        const sum = ['Q1','Q2','Q3','Q4'].reduce((s, q) => s + (Number(inputs[q].value) || 0), 0);
        totalTd.textContent = sum % 1 === 0 ? sum : sum.toFixed(1);
      };
      updateTotal();
      Object.values(inputs).forEach(inp => inp.addEventListener('input', updateTotal));
      tr.appendChild(totalTd);

      // Save button
      const actionsTd = document.createElement('td');
      actionsTd.className = 'py-2 px-2';
      const saveBtn = document.createElement('button');
      saveBtn.className = 'px-3 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700';
      saveBtn.textContent = 'Save';
      saveBtn.addEventListener('click', async () => {
        try {
          saveBtn.textContent = '...';
          saveBtn.disabled = true;
          const resp = await fetch('/api/UpdateProject', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: project.id,
              code: project.code,
              name: project.name,
              color: project.color,
              isActive: project.isActive,
              budgetQ1: Number(inputs.Q1.value) || 0,
              budgetQ2: Number(inputs.Q2.value) || 0,
              budgetQ3: Number(inputs.Q3.value) || 0,
              budgetQ4: Number(inputs.Q4.value) || 0
            })
          });
          if (!resp.ok) throw new Error(await resp.text());
          saveBtn.textContent = 'Saved!';
          saveBtn.className = 'px-3 py-1 bg-green-600 text-white rounded text-xs';
          setTimeout(() => {
            saveBtn.textContent = 'Save';
            saveBtn.className = 'px-3 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700';
            saveBtn.disabled = false;
          }, 1500);
        } catch (err) {
          saveBtn.textContent = 'Error';
          saveBtn.className = 'px-3 py-1 bg-red-600 text-white rounded text-xs';
          console.error('Error saving budget:', err);
          setTimeout(() => {
            saveBtn.textContent = 'Save';
            saveBtn.className = 'px-3 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700';
            saveBtn.disabled = false;
          }, 2000);
        }
      });
      actionsTd.appendChild(saveBtn);
      tr.appendChild(actionsTd);

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    contentEl.appendChild(table);
  }

  // ====== USERS TAB ======
  async function loadUsersTab(contentEl) {
    const response = await fetch('/api/GetUsers');
    if (!response.ok) throw new Error('Failed to load users');
    adminData.users = await response.json();

    contentEl.textContent = '';

    // Description
    const desc = document.createElement('p');
    desc.className = 'text-sm text-slate-500 mb-4';
    desc.textContent = 'Users appear automatically after their first login. Toggle admin access below.';
    contentEl.appendChild(desc);

    if (adminData.users.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'text-center py-8 text-slate-400';
      emptyDiv.textContent = 'No users found yet.';
      contentEl.appendChild(emptyDiv);
      return;
    }

    // Users table
    const table = document.createElement('table');
    table.className = 'w-full text-sm';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.className = 'border-b text-left text-slate-500';
    ['Email', 'Admin', 'Last Seen', 'First Seen'].forEach(text => {
      const th = document.createElement('th');
      th.className = 'py-2 px-2';
      th.textContent = text;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    // Sort: admins first, then by email
    const sortedUsers = [...adminData.users].sort((a, b) => {
      if (a.isAdmin && !b.isAdmin) return -1;
      if (!a.isAdmin && b.isAdmin) return 1;
      return (a.email || a.userId).localeCompare(b.email || b.userId);
    });

    sortedUsers.forEach(user => {
      const tr = document.createElement('tr');
      tr.className = 'border-b hover:bg-slate-50';

      // Email
      const emailTd = document.createElement('td');
      emailTd.className = 'py-2 px-2';
      const emailSpan = document.createElement('span');
      emailSpan.className = 'text-sm';
      emailSpan.textContent = user.email || user.userId;
      emailTd.appendChild(emailSpan);
      tr.appendChild(emailTd);

      // Admin toggle
      const adminTd = document.createElement('td');
      adminTd.className = 'py-2 px-2';
      const toggleLabel = document.createElement('label');
      toggleLabel.className = 'relative inline-flex items-center cursor-pointer';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = user.isAdmin;
      checkbox.className = 'sr-only peer';
      const toggleSlider = document.createElement('div');
      toggleSlider.className = 'w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[\'\'] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600';

      checkbox.addEventListener('change', async () => {
        try {
          checkbox.disabled = true;
          const resp = await fetch('/api/UpdateUser', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'toggleAdmin', userId: user.userId })
          });
          if (!resp.ok) {
            const errText = await resp.text();
            checkbox.checked = user.isAdmin; // revert
            if (errText.includes('Cannot toggle your own')) {
              const note = document.createElement('span');
              note.className = 'ml-2 text-xs text-red-500';
              note.textContent = "(Can't change self)";
              adminTd.appendChild(note);
              setTimeout(() => note.remove(), 2000);
            }
          } else {
            user.isAdmin = !user.isAdmin;
          }
          checkbox.disabled = false;
        } catch (err) {
          checkbox.checked = user.isAdmin; // revert
          checkbox.disabled = false;
          console.error('Error toggling admin:', err);
        }
      });

      toggleLabel.appendChild(checkbox);
      toggleLabel.appendChild(toggleSlider);
      adminTd.appendChild(toggleLabel);
      tr.appendChild(adminTd);

      // Last seen
      const lastSeenTd = document.createElement('td');
      lastSeenTd.className = 'py-2 px-2 text-xs text-slate-400';
      lastSeenTd.textContent = user.lastSeen ? new Date(user.lastSeen).toLocaleDateString() : '-';
      tr.appendChild(lastSeenTd);

      // First seen
      const firstSeenTd = document.createElement('td');
      firstSeenTd.className = 'py-2 px-2 text-xs text-slate-400';
      firstSeenTd.textContent = user.firstSeen ? new Date(user.firstSeen).toLocaleDateString() : '-';
      tr.appendChild(firstSeenTd);

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    contentEl.appendChild(table);
  }

  // ====== USER TIMESHEETS TAB ======
  async function loadTimesheetsTab(contentEl) {
    contentEl.textContent = '';
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'text-center py-8 text-slate-400';
    loadingDiv.textContent = 'Loading users...';
    contentEl.appendChild(loadingDiv);

    const response = await fetch('/api/GetAllUsersTimesheets');
    if (!response.ok) throw new Error('Failed to load timesheets');
    adminData.usersTimesheets = await response.json();

    contentEl.textContent = '';

    if (adminData.usersTimesheets.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'text-center py-8 text-slate-400';
      emptyDiv.textContent = 'No timesheet data found.';
      contentEl.appendChild(emptyDiv);
      return;
    }

    // User selector
    const selectorRow = document.createElement('div');
    selectorRow.className = 'mb-4 flex gap-3 items-center';

    const label = document.createElement('label');
    label.className = 'text-sm font-medium text-slate-700';
    label.textContent = 'User:';

    const select = document.createElement('select');
    select.className = 'px-3 py-2 border rounded text-sm flex-1';

    adminData.usersTimesheets.forEach(user => {
      const opt = document.createElement('option');
      opt.value = user.userId;
      opt.textContent = user.userEmail || user.userId;
      select.appendChild(opt);
    });

    selectorRow.appendChild(label);
    selectorRow.appendChild(select);
    contentEl.appendChild(selectorRow);

    // Week view area
    const weekView = document.createElement('div');
    contentEl.appendChild(weekView);

    // Load first user's data
    select.addEventListener('change', () => renderUserTimesheets(weekView, select.value));
    renderUserTimesheets(weekView, select.value);
  }

  function renderUserTimesheets(container, userId) {
    const userData = adminData.usersTimesheets.find(u => u.userId === userId);
    if (!userData || !userData.weeks) {
      container.textContent = '';
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'text-center py-4 text-slate-400';
      emptyDiv.textContent = 'No data for this user.';
      container.appendChild(emptyDiv);
      return;
    }

    container.textContent = '';

    const weeks = Object.keys(userData.weeks).sort((a, b) => {
      const parseStart = w => {
        const parts = w.split(' - ')[0].split('/');
        return new Date(parts[2], parts[0] - 1, parts[1]);
      };
      return parseStart(b) - parseStart(a); // Most recent first
    });

    weeks.forEach(weekKey => {
      const entries = userData.weeks[weekKey];
      const weekSection = document.createElement('div');
      weekSection.className = 'mb-4 border rounded-lg overflow-hidden';

      const weekHeader = document.createElement('div');
      weekHeader.className = 'px-4 py-2 bg-slate-50 font-medium text-sm text-slate-700 flex justify-between items-center cursor-pointer';

      const weekLabel = document.createElement('span');
      weekLabel.textContent = 'Week of ' + weekKey;

      const total = entries.reduce((sum, e) => sum + (Number(e.percentage) || 0), 0);
      const totalLabel = document.createElement('span');
      totalLabel.className = (total === 100 ? 'text-green-600' : 'text-red-600') + ' text-xs';
      totalLabel.textContent = total + '%';

      weekHeader.appendChild(weekLabel);
      weekHeader.appendChild(totalLabel);

      const weekBody = document.createElement('div');
      weekBody.className = 'px-4 py-2 hidden';

      entries.forEach(entry => {
        const row = document.createElement('div');
        row.className = 'flex justify-between py-1 text-sm border-b last:border-0';

        const nameSpan = document.createElement('span');
        nameSpan.textContent = entry.projectName || entry.projectId;
        const pctSpan = document.createElement('span');
        pctSpan.className = 'text-slate-500';
        pctSpan.textContent = entry.percentage + '%';

        row.appendChild(nameSpan);
        row.appendChild(pctSpan);
        weekBody.appendChild(row);
      });

      weekHeader.addEventListener('click', () => {
        weekBody.classList.toggle('hidden');
      });

      weekSection.appendChild(weekHeader);
      weekSection.appendChild(weekBody);
      container.appendChild(weekSection);
    });
  }
  // ====== ANALYTICS TAB ======
  async function loadAnalyticsTab(contentEl) {
    const response = await fetch('/api/GetProjectAnalytics');
    if (!response.ok) throw new Error('Failed to load analytics');
    const analytics = await response.json();

    contentEl.textContent = '';

    if (analytics.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'text-center py-8 text-slate-400';
      emptyDiv.textContent = 'No analytics data available. Set project budgets and submit timesheets first.';
      contentEl.appendChild(emptyDiv);
      return;
    }

    // Chart container
    const chartContainer = document.createElement('div');
    chartContainer.className = 'mb-6';
    chartContainer.style.height = '400px';
    const canvas = document.createElement('canvas');
    canvas.id = 'analytics-chart';
    chartContainer.appendChild(canvas);
    contentEl.appendChild(chartContainer);

    // Build chart data
    const labels = analytics.map(p => p.projectName);
    const budgetData = analytics.map(p => p.budgetHours);
    const actualData = analytics.map(p => p.actualHours);
    const barColors = analytics.map(p => p.isOverBudget ? '#EF4444' : '#6366F1');

    // Destroy existing chart if any
    const existingChart = Chart.getChart(canvas);
    if (existingChart) existingChart.destroy();

    new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Budget Hours',
            data: budgetData,
            backgroundColor: '#CBD5E1',
            borderRadius: 4
          },
          {
            label: 'Actual Hours',
            data: actualData,
            backgroundColor: barColors,
            borderRadius: 4
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            beginAtZero: true,
            title: { display: true, text: 'Hours' }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Budget vs Actual Hours by Project',
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            position: 'bottom'
          },
          tooltip: {
            callbacks: {
              afterBody: function(tooltipItems) {
                const idx = tooltipItems[0].dataIndex;
                const proj = analytics[idx];
                if (proj.isOverBudget) {
                  return 'Over budget by ' + proj.overBy + ' hours';
                }
                return '';
              }
            }
          }
        }
      }
    });

    // Over-budget detail table
    const overBudgetProjects = analytics.filter(p => p.isOverBudget);
    if (overBudgetProjects.length > 0) {
      const sectionTitle = document.createElement('h4');
      sectionTitle.className = 'text-lg font-bold text-red-600 mt-6 mb-3';
      sectionTitle.textContent = 'Over-Budget Projects';
      contentEl.appendChild(sectionTitle);

      overBudgetProjects.forEach(proj => {
        const section = document.createElement('div');
        section.className = 'mb-3 border border-red-200 rounded-lg overflow-hidden';

        const header = document.createElement('div');
        header.className = 'px-4 py-3 bg-red-50 flex justify-between items-center cursor-pointer';

        const headerLeft = document.createElement('div');
        const projName = document.createElement('span');
        projName.className = 'font-medium';
        projName.textContent = proj.projectName;
        const overLabel = document.createElement('span');
        overLabel.className = 'ml-2 text-sm text-red-500';
        overLabel.textContent = '+' + proj.overBy + ' hrs over';
        headerLeft.appendChild(projName);
        headerLeft.appendChild(overLabel);

        const headerRight = document.createElement('span');
        headerRight.className = 'text-sm text-slate-500';
        headerRight.textContent = proj.actualHours + ' / ' + proj.budgetHours + ' hrs';

        header.appendChild(headerLeft);
        header.appendChild(headerRight);

        const body = document.createElement('div');
        body.className = 'px-4 py-2 hidden';

        // User breakdown table
        const userTable = document.createElement('table');
        userTable.className = 'w-full text-sm';

        const utHead = document.createElement('thead');
        const utHeaderRow = document.createElement('tr');
        utHeaderRow.className = 'text-left text-slate-500';
        ['User', 'Hours'].forEach(text => {
          const th = document.createElement('th');
          th.className = 'py-1 px-2';
          th.textContent = text;
          utHeaderRow.appendChild(th);
        });
        utHead.appendChild(utHeaderRow);
        userTable.appendChild(utHead);

        const utBody = document.createElement('tbody');
        proj.userBreakdown.forEach(user => {
          const tr = document.createElement('tr');
          tr.className = 'border-t';

          const emailTd = document.createElement('td');
          emailTd.className = 'py-1 px-2';
          emailTd.textContent = user.userEmail;

          const hoursTd = document.createElement('td');
          hoursTd.className = 'py-1 px-2';
          hoursTd.textContent = user.totalHours;

          tr.appendChild(emailTd);
          tr.appendChild(hoursTd);
          utBody.appendChild(tr);
        });
        userTable.appendChild(utBody);
        body.appendChild(userTable);

        header.addEventListener('click', () => {
          body.classList.toggle('hidden');
        });

        section.appendChild(header);
        section.appendChild(body);
        contentEl.appendChild(section);
      });
    }

    // Summary for on-budget projects
    const onBudgetProjects = analytics.filter(p => !p.isOverBudget && p.budgetHours > 0);
    if (onBudgetProjects.length > 0) {
      const sectionTitle = document.createElement('h4');
      sectionTitle.className = 'text-lg font-bold text-green-600 mt-6 mb-3';
      sectionTitle.textContent = 'On-Budget Projects';
      contentEl.appendChild(sectionTitle);

      onBudgetProjects.forEach(proj => {
        const row = document.createElement('div');
        row.className = 'flex justify-between items-center py-2 px-4 border-b';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'text-sm';
        nameSpan.textContent = proj.projectName;

        const statsSpan = document.createElement('span');
        statsSpan.className = 'text-sm text-slate-500';
        statsSpan.textContent = proj.actualHours + ' / ' + proj.budgetHours + ' hrs';

        row.appendChild(nameSpan);
        row.appendChild(statsSpan);
        contentEl.appendChild(row);
      });
    }
  }

})();

