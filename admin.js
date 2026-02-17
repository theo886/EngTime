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
      { id: 'defaults', label: 'Default Projects' },
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
        case 'defaults': await loadDefaultsTab(contentEl); break;
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
      const name = nameInput.value.trim();
      const color = colorInput.value;

      if (!id || !name) {
        errorEl.textContent = 'All fields are required.';
        errorEl.classList.remove('hidden');
        return;
      }

      try {
        const resp = await fetch('/api/UpdateProject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: id, name, color, isActive: existingProject?.isActive !== false })
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

  // ====== DEFAULT PROJECTS TAB ======
  async function loadDefaultsTab(contentEl) {
    const response = await fetch('/api/GetProjects?includeInactive=false');
    if (!response.ok) throw new Error('Failed to load projects');
    const projectsList = await response.json();

    contentEl.textContent = '';

    // Description
    const desc = document.createElement('p');
    desc.className = 'text-sm text-slate-500 mb-4';
    desc.textContent = 'Configure which projects appear by default when users start a new week. Remaining percentage will be available for users to allocate.';
    contentEl.appendChild(desc);

    const projectsContainer = document.createElement('div');
    projectsContainer.className = 'space-y-2 mb-4';

    // Track original state for change detection + current state
    const originalState = {};
    const state = {};
    projectsList.forEach(p => {
      const s = { selected: p.isDefault === true, percentage: p.defaultPercentage || 0 };
      originalState[p.id] = { ...s };
      state[p.id] = { ...s };
    });

    // Total display element (declared early for updateTotal)
    const totalDisplay = document.createElement('span');

    function updateTotal() {
      const total = Object.values(state)
        .filter(s => s.selected)
        .reduce((sum, s) => sum + s.percentage, 0);
      totalDisplay.textContent = total + '%';
      totalDisplay.className = total <= 100
        ? 'text-2xl font-bold text-green-600'
        : 'text-2xl font-bold text-red-600';
    }

    // Render rows: checkbox + color swatch + label + percentage input
    projectsList.forEach(project => {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-3 p-2 hover:bg-slate-50 rounded';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = state[project.id].selected;
      checkbox.className = 'h-4 w-4 text-indigo-600';

      const colorBox = document.createElement('div');
      colorBox.className = 'w-4 h-4 rounded';
      colorBox.style.backgroundColor = project.color;

      const label = document.createElement('span');
      label.className = 'text-sm flex-1';
      label.textContent = project.id + ' - ' + project.name;

      const percentInput = document.createElement('input');
      percentInput.type = 'number';
      percentInput.min = '0';
      percentInput.max = '100';
      percentInput.value = state[project.id].percentage;
      percentInput.disabled = !state[project.id].selected;
      percentInput.className = 'w-20 px-2 py-1 border rounded text-sm text-right';

      checkbox.addEventListener('change', () => {
        state[project.id].selected = checkbox.checked;
        percentInput.disabled = !checkbox.checked;
        if (!checkbox.checked) { percentInput.value = 0; state[project.id].percentage = 0; }
        updateTotal();
      });

      percentInput.addEventListener('input', () => {
        state[project.id].percentage = parseFloat(percentInput.value) || 0;
        updateTotal();
      });

      const pctLabel = document.createElement('span');
      pctLabel.className = 'text-sm text-slate-500';
      pctLabel.textContent = '%';

      row.appendChild(checkbox);
      row.appendChild(colorBox);
      row.appendChild(label);
      row.appendChild(percentInput);
      row.appendChild(pctLabel);
      projectsContainer.appendChild(row);
    });

    contentEl.appendChild(projectsContainer);

    // Total display row
    const totalRow = document.createElement('div');
    totalRow.className = 'flex justify-between items-center p-4 bg-slate-100 rounded mb-4';
    const totalLabel = document.createElement('span');
    totalLabel.className = 'text-sm font-medium text-slate-700';
    totalLabel.textContent = 'Total:';
    totalRow.appendChild(totalLabel);
    totalRow.appendChild(totalDisplay);
    contentEl.appendChild(totalRow);

    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save Default Configuration';
    saveBtn.className = 'px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm';

    const errorEl = document.createElement('div');
    errorEl.className = 'mt-2 text-red-500 text-sm hidden';

    saveBtn.addEventListener('click', async () => {
      try {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        // Only update projects whose default state changed
        const changed = projectsList.filter(p => {
          const o = originalState[p.id];
          const s = state[p.id];
          return o.selected !== s.selected || o.percentage !== s.percentage;
        });

        const updates = changed.map(project => {
          const s = state[project.id];
          return fetch('/api/UpdateProject', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId: project.id,
              name: project.name,
              color: project.color,
              isActive: project.isActive,
              isDefault: s.selected,
              defaultPercentage: s.selected ? s.percentage : 0
            })
          }).then(r => {
            if (!r.ok) throw new Error('Failed to update ' + project.id);
          });
        });

        await Promise.all(updates);

        // Update original state to match current
        projectsList.forEach(p => { originalState[p.id] = { ...state[p.id] }; });

        errorEl.classList.add('hidden');
        saveBtn.textContent = 'Saved!';
        setTimeout(() => {
          saveBtn.textContent = 'Save Default Configuration';
          saveBtn.disabled = false;
        }, 2000);
      } catch (err) {
        errorEl.textContent = 'Error saving: ' + err.message;
        errorEl.classList.remove('hidden');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Default Configuration';
      }
    });

    contentEl.appendChild(saveBtn);
    contentEl.appendChild(errorEl);
    updateTotal();
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

    // Filter to active projects for export/import
    const activeProjects = projectsList.filter(p => p.isActive);

    // Export/Import buttons
    const btnRow = document.createElement('div');
    btnRow.className = 'mb-4 flex gap-2';

    const exportBtn = document.createElement('button');
    exportBtn.className = 'px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700';
    exportBtn.textContent = 'Export to Excel';
    exportBtn.addEventListener('click', () => {
      if (typeof XLSX === 'undefined') {
        alert('Excel library failed to load. Please refresh the page.');
        return;
      }
      exportBudgetsToExcel(activeProjects);
      exportBtn.textContent = 'Downloaded!';
      exportBtn.className = 'px-4 py-2 bg-green-700 text-white rounded text-sm';
      setTimeout(() => {
        exportBtn.textContent = 'Export to Excel';
        exportBtn.className = 'px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700';
      }, 1500);
    });

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.xlsx,.xls';
    fileInput.className = 'hidden';
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        handleBudgetImport(file, activeProjects, contentEl);
        fileInput.value = '';
      }
    });

    const importBtn = document.createElement('button');
    importBtn.className = 'px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700';
    importBtn.textContent = 'Import from Excel';
    importBtn.addEventListener('click', () => {
      if (typeof XLSX === 'undefined') {
        alert('Excel library failed to load. Please refresh the page.');
        return;
      }
      fileInput.click();
    });

    btnRow.appendChild(exportBtn);
    btnRow.appendChild(importBtn);
    btnRow.appendChild(fileInput);
    contentEl.appendChild(btnRow);

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

  // ====== BUDGET EXCEL EXPORT/IMPORT ======
  function exportBudgetsToExcel(activeProjects) {
    const rows = activeProjects.map(p => ({
      'Project ID': p.id,
      'Project Name': p.name,
      'Q1 FTE': p.budgetQ1 || 0,
      'Q2 FTE': p.budgetQ2 || 0,
      'Q3 FTE': p.budgetQ3 || 0,
      'Q4 FTE': p.budgetQ4 || 0
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 20 },  // Project ID
      { wch: 35 },  // Project Name
      { wch: 10 },  // Q1
      { wch: 10 },  // Q2
      { wch: 10 },  // Q3
      { wch: 10 }   // Q4
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Budgets');

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, 'EngTime_Budgets_' + today + '.xlsx');
  }

  function handleBudgetImport(file, activeProjects, contentEl) {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);

        if (rows.length === 0) {
          showImportMessage(contentEl, 'The imported file contains no data rows.', 'red');
          return;
        }

        // Validate column headers (case-insensitive)
        const firstRow = rows[0];
        const keys = Object.keys(firstRow);
        const findCol = (target) => keys.find(k => k.toLowerCase().replace(/\s+/g, '') === target.toLowerCase().replace(/\s+/g, ''));

        const colId = findCol('ProjectID');
        const colQ1 = findCol('Q1FTE');
        const colQ2 = findCol('Q2FTE');
        const colQ3 = findCol('Q3FTE');
        const colQ4 = findCol('Q4FTE');

        if (!colId) {
          showImportMessage(contentEl, 'Missing required column: "Project ID". Please use the exported template.', 'red');
          return;
        }
        if (!colQ1 || !colQ2 || !colQ3 || !colQ4) {
          showImportMessage(contentEl, 'Missing one or more Q columns (Q1 FTE, Q2 FTE, Q3 FTE, Q4 FTE). Please use the exported template.', 'red');
          return;
        }

        // Validate each row
        const errors = [];
        const activeIds = new Set(activeProjects.map(p => p.id));
        const importedRows = [];

        rows.forEach((row, idx) => {
          const rowNum = idx + 2; // 1-indexed + header
          const projectId = String(row[colId] || '').trim();

          if (!projectId) {
            errors.push('Row ' + rowNum + ': Missing Project ID');
            return;
          }
          if (!activeIds.has(projectId)) {
            errors.push('Row ' + rowNum + ': Unknown or inactive project "' + projectId + '"');
            return;
          }

          const q1 = Number(row[colQ1]);
          const q2 = Number(row[colQ2]);
          const q3 = Number(row[colQ3]);
          const q4 = Number(row[colQ4]);

          if (isNaN(q1) || q1 < 0) { errors.push('Row ' + rowNum + ': Invalid Q1 value'); return; }
          if (isNaN(q2) || q2 < 0) { errors.push('Row ' + rowNum + ': Invalid Q2 value'); return; }
          if (isNaN(q3) || q3 < 0) { errors.push('Row ' + rowNum + ': Invalid Q3 value'); return; }
          if (isNaN(q4) || q4 < 0) { errors.push('Row ' + rowNum + ': Invalid Q4 value'); return; }

          importedRows.push({ projectId, q1, q2, q3, q4 });
        });

        if (errors.length > 0) {
          showImportMessage(contentEl, 'Validation errors:\n' + errors.join('\n'), 'red');
          return;
        }

        const changes = computeBudgetDiff(importedRows, activeProjects);
        if (changes.length === 0) {
          showImportMessage(contentEl, 'No changes detected. All imported values match current budgets.', 'blue');
          return;
        }

        showImportPreviewModal(changes, contentEl);
      } catch (err) {
        showImportMessage(contentEl, 'Failed to parse Excel file: ' + err.message, 'red');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function showImportMessage(contentEl, message, color) {
    // Remove any existing import message
    const existing = contentEl.querySelector('.budget-import-msg');
    if (existing) existing.remove();

    const msgDiv = document.createElement('div');
    msgDiv.className = 'budget-import-msg mb-4 p-3 rounded text-sm whitespace-pre-wrap '
      + (color === 'red' ? 'bg-red-50 text-red-700 border border-red-200'
        : color === 'blue' ? 'bg-blue-50 text-blue-700 border border-blue-200'
        : 'bg-green-50 text-green-700 border border-green-200');
    msgDiv.textContent = message;

    // Insert after button row
    const btnRow = contentEl.querySelector('div.mb-4.flex.gap-2');
    if (btnRow && btnRow.nextSibling) {
      contentEl.insertBefore(msgDiv, btnRow.nextSibling);
    } else {
      contentEl.appendChild(msgDiv);
    }

    // Auto-dismiss after 8 seconds
    setTimeout(() => { if (msgDiv.parentNode) msgDiv.remove(); }, 8000);
  }

  function computeBudgetDiff(importedRows, activeProjects) {
    const projectMap = {};
    activeProjects.forEach(p => { projectMap[p.id] = p; });

    const changes = [];
    importedRows.forEach(row => {
      const project = projectMap[row.projectId];
      if (!project) return;

      const diffs = {};
      let hasChanges = false;

      ['Q1', 'Q2', 'Q3', 'Q4'].forEach(q => {
        const oldVal = Number(project['budget' + q]) || 0;
        const newVal = row[q.toLowerCase()];
        if (oldVal !== newVal) {
          diffs[q] = { old: oldVal, new: newVal };
          hasChanges = true;
        }
      });

      if (hasChanges) {
        changes.push({
          projectId: project.id,
          projectName: project.name,
          project: project,
          changes: diffs
        });
      }
    });

    return changes;
  }

  function showImportPreviewModal(changes, contentEl) {
    // Full-screen overlay
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50';

    const modal = document.createElement('div');
    modal.className = 'bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col overflow-hidden';

    // Header
    const header = document.createElement('div');
    header.className = 'p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b';
    const title = document.createElement('h3');
    title.className = 'text-lg font-bold text-indigo-800';
    title.textContent = 'Import Budget Changes (' + changes.length + ' project' + (changes.length !== 1 ? 's' : '') + ')';
    header.appendChild(title);
    modal.appendChild(header);

    // Body - scrollable diff table
    const body = document.createElement('div');
    body.className = 'p-4 overflow-y-auto flex-1';

    const table = document.createElement('table');
    table.className = 'w-full text-sm';

    const thead = document.createElement('thead');
    const thRow = document.createElement('tr');
    thRow.className = 'border-b text-left text-slate-500';
    ['Project', 'Q1', 'Q2', 'Q3', 'Q4'].forEach(text => {
      const th = document.createElement('th');
      th.className = 'py-2 px-2' + (text !== 'Project' ? ' text-center' : '');
      th.textContent = text;
      thRow.appendChild(th);
    });
    thead.appendChild(thRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    changes.forEach(change => {
      const tr = document.createElement('tr');
      tr.className = 'border-b';

      const nameTd = document.createElement('td');
      nameTd.className = 'py-2 px-2';
      nameTd.textContent = change.projectName;
      tr.appendChild(nameTd);

      ['Q1', 'Q2', 'Q3', 'Q4'].forEach(q => {
        const td = document.createElement('td');
        td.className = 'py-2 px-2 text-center';

        if (change.changes[q]) {
          td.className += ' bg-yellow-50';
          const oldSpan = document.createElement('span');
          oldSpan.className = 'line-through text-slate-400 mr-1';
          oldSpan.textContent = change.changes[q].old;
          const newSpan = document.createElement('span');
          newSpan.className = 'text-green-700 font-medium';
          newSpan.textContent = change.changes[q].new;
          td.appendChild(oldSpan);
          td.appendChild(document.createTextNode(' '));
          td.appendChild(newSpan);
        } else {
          const currentVal = Number(change.project['budget' + q]) || 0;
          td.textContent = currentVal;
        }

        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    body.appendChild(table);
    modal.appendChild(body);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'p-4 border-t flex justify-end gap-3';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'px-4 py-2 text-slate-600 hover:bg-slate-100 rounded';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => overlay.remove());

    const applyBtn = document.createElement('button');
    applyBtn.className = 'px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700';
    applyBtn.textContent = 'Apply ' + changes.length + ' Change' + (changes.length !== 1 ? 's' : '');
    applyBtn.addEventListener('click', () => applyBudgetChanges(changes, contentEl, overlay, applyBtn));

    footer.appendChild(cancelBtn);
    footer.appendChild(applyBtn);
    modal.appendChild(footer);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Close on backdrop click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  async function applyBudgetChanges(changes, contentEl, overlay, applyBtn) {
    applyBtn.disabled = true;
    applyBtn.textContent = 'Saving... (0/' + changes.length + ')';

    const failures = [];
    for (let i = 0; i < changes.length; i++) {
      const change = changes[i];
      const project = change.project;
      try {
        const resp = await fetch('/api/UpdateProject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: project.id,
            name: project.name,
            color: project.color,
            isActive: project.isActive,
            budgetQ1: change.changes.Q1 ? change.changes.Q1.new : (Number(project.budgetQ1) || 0),
            budgetQ2: change.changes.Q2 ? change.changes.Q2.new : (Number(project.budgetQ2) || 0),
            budgetQ3: change.changes.Q3 ? change.changes.Q3.new : (Number(project.budgetQ3) || 0),
            budgetQ4: change.changes.Q4 ? change.changes.Q4.new : (Number(project.budgetQ4) || 0)
          })
        });
        if (!resp.ok) throw new Error(await resp.text());
      } catch (err) {
        failures.push(change.projectName + ': ' + err.message);
      }
      applyBtn.textContent = 'Saving... (' + (i + 1) + '/' + changes.length + ')';
    }

    overlay.remove();

    if (failures.length > 0) {
      showImportMessage(contentEl, 'Saved with ' + failures.length + ' error(s):\n' + failures.join('\n'), 'red');
    } else {
      showImportMessage(contentEl, 'Successfully updated ' + changes.length + ' project budget' + (changes.length !== 1 ? 's' : '') + '.', 'green');
    }

    // Reload the budgets tab to reflect changes
    await loadBudgetsTab(contentEl);
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
    ['Name', 'Email', 'Admin', 'Last Seen', 'First Seen'].forEach(text => {
      const th = document.createElement('th');
      th.className = 'py-2 px-2';
      th.textContent = text;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    // Sort: admins first, then by displayName/email
    const sortedUsers = [...adminData.users].sort((a, b) => {
      if (a.isAdmin && !b.isAdmin) return -1;
      if (!a.isAdmin && b.isAdmin) return 1;
      return (a.displayName || a.email || a.userId).localeCompare(b.displayName || b.email || b.userId);
    });

    sortedUsers.forEach(user => {
      const tr = document.createElement('tr');
      tr.className = 'border-b hover:bg-slate-50';

      // Name
      const nameTd = document.createElement('td');
      nameTd.className = 'py-2 px-2 font-medium';
      nameTd.textContent = user.displayName || user.email || user.userId;
      if (user.displayName) {
        nameTd.title = user.email;
      }
      tr.appendChild(nameTd);

      // Email
      const emailTd = document.createElement('td');
      emailTd.className = 'py-2 px-2';
      const emailSpan = document.createElement('span');
      emailSpan.className = 'text-sm text-slate-500';
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
    const loading = document.createElement('div');
    loading.className = 'text-center py-8 text-slate-400';
    loading.textContent = 'Loading...';
    contentEl.appendChild(loading);

    // Fetch projects (for edit dropdowns) and users in parallel
    const [projResp, usersResp] = await Promise.all([
      fetch('/api/GetProjects?includeInactive=false'),
      fetch('/api/GetUsers')
    ]);
    if (!projResp.ok || !usersResp.ok) throw new Error('Failed to load data');
    const projectsList = await projResp.json();
    const allUsers = (await usersResp.json()).sort((a, b) =>
      (a.displayName || a.email || a.userId).localeCompare(b.displayName || b.email || b.userId)
    );

    contentEl.textContent = '';

    if (allUsers.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'text-center py-8 text-slate-400';
      emptyDiv.textContent = 'No users found.';
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
    allUsers.forEach(user => {
      const opt = document.createElement('option');
      opt.value = user.userId;
      opt.textContent = user.displayName
        ? user.displayName + ' (' + (user.email || user.userId) + ')'
        : (user.email || user.userId);
      opt.dataset.email = user.email || '';
      select.appendChild(opt);
    });
    selectorRow.appendChild(label);
    selectorRow.appendChild(select);
    contentEl.appendChild(selectorRow);

    // "New Timesheet" button
    const newBtn = document.createElement('button');
    newBtn.className = 'mb-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm';
    newBtn.textContent = '+ New Timesheet';
    contentEl.appendChild(newBtn);

    // Week view area
    const weekView = document.createElement('div');
    contentEl.appendChild(weekView);

    // State for current user's timesheets
    let currentUserData = null;

    async function loadUserData(userId) {
      weekView.textContent = '';
      const loadDiv = document.createElement('div');
      loadDiv.className = 'text-center py-4 text-slate-400';
      loadDiv.textContent = 'Loading timesheets...';
      weekView.appendChild(loadDiv);

      try {
        const resp = await fetch('/api/GetAllUsersTimesheets?userId=' + encodeURIComponent(userId));
        if (!resp.ok) throw new Error('Failed to load timesheets');
        const data = await resp.json();
        currentUserData = data.find(u => u.userId === userId) || { userId, userEmail: '', weeks: {} };
      } catch (err) {
        currentUserData = { userId: select.value, userEmail: '', weeks: {} };
      }
      renderUserTimesheets(weekView, currentUserData, projectsList, select);
    }

    select.addEventListener('change', () => loadUserData(select.value));

    newBtn.addEventListener('click', () => {
      showNewTimesheetForm(weekView, select, currentUserData, projectsList, loadUserData);
    });

    // Load first user
    await loadUserData(select.value);
  }

  function renderUserTimesheets(container, userData, projectsList, userSelect) {
    container.textContent = '';

    if (!userData.weeks || Object.keys(userData.weeks).length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'text-center py-8 text-slate-400';
      emptyDiv.textContent = 'No timesheets for this user. Use "+ New Timesheet" to create one.';
      container.appendChild(emptyDiv);
      return;
    }

    // Sort weeks most recent first
    const weeks = Object.keys(userData.weeks).sort((a, b) => {
      const parseStart = w => {
        const parts = w.split(' - ')[0].split('/');
        return new Date(parts[2], parts[0] - 1, parts[1]);
      };
      return parseStart(b) - parseStart(a);
    });

    weeks.forEach(weekKey => {
      const weekEntries = userData.weeks[weekKey];
      const weekSection = document.createElement('div');
      weekSection.className = 'mb-4 border rounded-lg overflow-hidden';

      // Header with week label, total, and Edit button
      const weekHeader = document.createElement('div');
      weekHeader.className = 'px-4 py-2 bg-slate-50 font-medium text-sm text-slate-700 flex justify-between items-center';

      const weekLabel = document.createElement('span');
      weekLabel.className = 'cursor-pointer flex-1';
      weekLabel.textContent = 'Week of ' + weekKey;

      const total = weekEntries.reduce((sum, e) => sum + (Number(e.percentage) || 0), 0);
      const totalBadge = document.createElement('span');
      totalBadge.className = (total === 100 ? 'text-green-600' : 'text-red-600') + ' text-xs mr-3';
      totalBadge.textContent = total + '%';

      const editBtn = document.createElement('button');
      editBtn.className = 'px-3 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200';
      editBtn.textContent = 'Edit';

      weekHeader.appendChild(weekLabel);
      weekHeader.appendChild(totalBadge);
      weekHeader.appendChild(editBtn);

      // Body (read-only by default, toggled by clicking week label)
      const weekBody = document.createElement('div');
      weekBody.className = 'px-4 py-2 hidden';
      renderReadOnlyEntries(weekBody, weekEntries);

      weekLabel.addEventListener('click', () => weekBody.classList.toggle('hidden'));

      // Edit button handler
      editBtn.addEventListener('click', () => {
        weekBody.classList.remove('hidden');
        showEditForm(weekBody, weekKey, weekEntries, userData, projectsList, userSelect, container);
      });

      weekSection.appendChild(weekHeader);
      weekSection.appendChild(weekBody);
      container.appendChild(weekSection);
    });
  }

  function renderReadOnlyEntries(container, entries) {
    container.textContent = '';
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
      container.appendChild(row);
    });
  }

  function showEditForm(weekBody, weekKey, existingEntries, userData, projectsList, userSelect, parentContainer) {
    weekBody.textContent = '';

    // Local mutable entries state
    let editEntries = existingEntries.map((e, i) => ({
      id: Date.now() + i,
      projectId: e.projectId,
      percentage: Number(e.percentage) || 0
    }));

    const entriesContainer = document.createElement('div');
    const totalRow = document.createElement('div');
    totalRow.className = 'flex justify-between items-center py-2 text-sm font-medium';
    const totalLabel = document.createElement('span');
    totalLabel.textContent = 'Total:';
    const totalValue = document.createElement('span');
    totalRow.appendChild(totalLabel);
    totalRow.appendChild(totalValue);

    // Action buttons (declared early so updateTotal can reference saveBtn)
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';

    function updateTotal() {
      const sum = editEntries.reduce((s, e) => s + e.percentage, 0);
      totalValue.textContent = sum + '%';
      totalValue.className = sum === 100 ? 'text-green-600 font-bold' : 'text-red-600 font-bold';
      const hasEmptyProject = editEntries.some(e => !e.projectId);
      const projectIds = editEntries.filter(e => e.projectId).map(e => e.projectId);
      const hasDuplicates = new Set(projectIds).size !== projectIds.length;
      saveBtn.disabled = sum !== 100 || hasEmptyProject || hasDuplicates || editEntries.length === 0;
      saveBtn.className = saveBtn.disabled
        ? 'px-4 py-1.5 bg-slate-300 text-white rounded text-sm cursor-not-allowed'
        : 'px-4 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm';
    }

    function renderEditRows() {
      entriesContainer.textContent = '';
      editEntries.forEach(entry => {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-2 py-1.5 border-b';

        // Color dot
        const colorDot = document.createElement('span');
        colorDot.className = 'w-3 h-3 rounded-full flex-shrink-0';
        const proj = projectsList.find(p => p.id === entry.projectId);
        colorDot.style.backgroundColor = proj ? proj.color : '#ccc';

        // Project select
        const sel = document.createElement('select');
        sel.className = 'flex-1 px-2 py-1 border rounded text-sm';
        const emptyOpt = document.createElement('option');
        emptyOpt.value = '';
        emptyOpt.textContent = '-- Select Project --';
        sel.appendChild(emptyOpt);
        projectsList.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.textContent = p.id + ' - ' + p.name;
          if (p.id === entry.projectId) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.addEventListener('change', () => {
          entry.projectId = sel.value;
          const p = projectsList.find(x => x.id === sel.value);
          colorDot.style.backgroundColor = p ? p.color : '#ccc';
          updateTotal();
        });

        // Percentage input
        const pctInput = document.createElement('input');
        pctInput.type = 'number';
        pctInput.min = '0';
        pctInput.max = '100';
        pctInput.value = entry.percentage;
        pctInput.className = 'w-20 px-2 py-1 border rounded text-sm text-right';
        pctInput.addEventListener('input', () => {
          entry.percentage = parseInt(pctInput.value) || 0;
          updateTotal();
        });

        const pctLabel = document.createElement('span');
        pctLabel.className = 'text-xs text-slate-400';
        pctLabel.textContent = '%';

        // Remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'text-red-400 hover:text-red-600 text-lg leading-none px-1';
        removeBtn.textContent = '\u00D7';
        removeBtn.addEventListener('click', () => {
          editEntries = editEntries.filter(e => e.id !== entry.id);
          renderEditRows();
          updateTotal();
        });

        row.appendChild(colorDot);
        row.appendChild(sel);
        row.appendChild(pctInput);
        row.appendChild(pctLabel);
        row.appendChild(removeBtn);
        entriesContainer.appendChild(row);
      });
    }

    // Add Project button
    const addBtn = document.createElement('button');
    addBtn.className = 'mt-2 px-3 py-1 text-xs text-indigo-600 border border-dashed border-indigo-300 rounded hover:bg-indigo-50 w-full';
    addBtn.textContent = '+ Add Project';
    addBtn.addEventListener('click', () => {
      editEntries.push({ id: Date.now(), projectId: '', percentage: 0 });
      renderEditRows();
      updateTotal();
    });

    // Action buttons row
    const actionRow = document.createElement('div');
    actionRow.className = 'flex gap-2 mt-3 pt-2 border-t';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'px-4 py-1.5 text-slate-600 hover:bg-slate-100 rounded text-sm';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      renderReadOnlyEntries(weekBody, existingEntries);
    });

    const errorEl = document.createElement('div');
    errorEl.className = 'mt-2 text-red-500 text-xs hidden';

    saveBtn.addEventListener('click', async () => {
      try {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        errorEl.classList.add('hidden');

        const selectedOpt = userSelect.options[userSelect.selectedIndex];
        const resp = await fetch('/api/SaveTimeAllocationForUser', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUserId: userSelect.value,
            targetUserEmail: selectedOpt.dataset.email || '',
            week: weekKey,
            WeekStartDate: weekKey.split(' - ')[0],
            entries: editEntries.filter(e => e.projectId).map(e => ({
              projectId: e.projectId,
              projectName: projectsList.find(p => p.id === e.projectId)?.name || 'Unknown',
              percentage: e.percentage
            }))
          })
        });
        if (!resp.ok) throw new Error(await resp.text());

        // Update local data and re-render
        userData.weeks[weekKey] = editEntries.filter(e => e.projectId).map(e => ({
          projectId: e.projectId,
          projectName: projectsList.find(p => p.id === e.projectId)?.name || 'Unknown',
          percentage: e.percentage,
          hours: parseFloat((e.percentage * 0.4).toFixed(1))
        }));
        renderUserTimesheets(parentContainer, userData, projectsList, userSelect);
      } catch (err) {
        errorEl.textContent = 'Error: ' + err.message;
        errorEl.classList.remove('hidden');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      }
    });

    actionRow.appendChild(saveBtn);
    actionRow.appendChild(cancelBtn);

    weekBody.appendChild(entriesContainer);
    weekBody.appendChild(addBtn);
    weekBody.appendChild(totalRow);
    weekBody.appendChild(actionRow);
    weekBody.appendChild(errorEl);

    renderEditRows();
    updateTotal();
  }

  function showNewTimesheetForm(weekView, userSelect, currentUserData, projectsList, reloadFn) {
    // Toggle: remove existing form if open
    const existing = document.getElementById('new-timesheet-form');
    if (existing) { existing.remove(); return; }

    const form = document.createElement('div');
    form.id = 'new-timesheet-form';
    form.className = 'mb-4 p-4 border-2 border-dashed border-indigo-300 rounded-lg bg-indigo-50';

    const title = document.createElement('h4');
    title.className = 'font-medium text-sm text-indigo-800 mb-3';
    title.textContent = 'New Timesheet';

    // Week picker: date input that snaps to Monday
    const dateRow = document.createElement('div');
    dateRow.className = 'flex items-center gap-2 mb-3';
    const dateLabel = document.createElement('label');
    dateLabel.className = 'text-sm text-slate-600';
    dateLabel.textContent = 'Week starting:';
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'px-2 py-1 border rounded text-sm';
    // Default to current week's Monday
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
    dateInput.value = monday.toISOString().split('T')[0];

    const weekDisplay = document.createElement('span');
    weekDisplay.className = 'text-xs text-slate-500';

    function updateWeekDisplay() {
      const d = new Date(dateInput.value + 'T00:00:00');
      // Snap to Monday
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      const sun = new Date(d);
      sun.setDate(d.getDate() + 6);
      const fmt = dt => (dt.getMonth() + 1) + '/' + dt.getDate() + '/' + dt.getFullYear();
      weekDisplay.textContent = fmt(d) + ' - ' + fmt(sun);
    }
    dateInput.addEventListener('change', updateWeekDisplay);
    updateWeekDisplay();

    dateRow.appendChild(dateLabel);
    dateRow.appendChild(dateInput);
    dateRow.appendChild(weekDisplay);

    // Buttons
    const btnRow = document.createElement('div');
    btnRow.className = 'flex gap-2';
    const createBtn = document.createElement('button');
    createBtn.className = 'px-4 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700';
    createBtn.textContent = 'Create';
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'px-4 py-1.5 text-slate-600 hover:bg-slate-100 rounded text-sm';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => form.remove());

    const errorEl = document.createElement('div');
    errorEl.className = 'mt-2 text-red-500 text-xs hidden';

    createBtn.addEventListener('click', () => {
      const weekKey = weekDisplay.textContent;
      if (currentUserData && currentUserData.weeks && currentUserData.weeks[weekKey]) {
        errorEl.textContent = 'This week already exists. Use the Edit button on the existing week.';
        errorEl.classList.remove('hidden');
        return;
      }
      // Create empty week and switch to edit mode
      if (!currentUserData.weeks) currentUserData.weeks = {};
      currentUserData.weeks[weekKey] = [];
      form.remove();
      renderUserTimesheets(weekView, currentUserData, projectsList, userSelect);
      // Auto-open edit on the new week
      const editBtns = weekView.querySelectorAll('button');
      for (const btn of editBtns) {
        if (btn.textContent === 'Edit') {
          const section = btn.closest('.mb-4');
          if (section && section.querySelector('span') && section.querySelector('span').textContent.includes(weekKey)) {
            btn.click();
            break;
          }
        }
      }
    });

    btnRow.appendChild(createBtn);
    btnRow.appendChild(cancelBtn);

    form.appendChild(title);
    form.appendChild(dateRow);
    form.appendChild(btnRow);
    form.appendChild(errorEl);

    weekView.insertBefore(form, weekView.firstChild);
  }
  // ====== ANALYTICS TAB ======

  // --- Analytics helpers ---
  function getUtilization(project) {
    if (!project.budgetHours || project.budgetHours === 0) {
      return project.actualHours > 0 ? Infinity : 0;
    }
    return project.actualHours / project.budgetHours;
  }

  function formatUtilPct(utilization) {
    if (!isFinite(utilization)) return 'No Budget';
    return (utilization * 100).toFixed(1) + '%';
  }

  function getStatusColor(utilization) {
    if (utilization > 1.0) return '#EF4444';   // red-500
    if (utilization >= 0.8) return '#F59E0B';   // amber-500
    return '#10B981';                            // emerald-500
  }

  function getStatusLabel(utilization) {
    if (utilization > 1.0) return 'Over Budget';
    if (utilization >= 0.8) return 'Approaching';
    return 'On Track';
  }

  function sortProjectsByHours(data) {
    return data.slice().sort(function(a, b) {
      return b.actualHours - a.actualHours;
    });
  }

  function formatNumber(n) {
    return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
  }

  function truncateLabel(label, maxLen) {
    if (label.length <= maxLen) return label;
    return label.substring(0, maxLen - 1) + '\u2026';
  }

  function calcYtdBudgetHours(project, startDate, endDate) {
    var now = new Date();
    var year = now.getFullYear();
    var quarterRanges = [
      { fte: project.budgetQ1 || 0, start: new Date(year, 0, 1),  end: new Date(year, 2, 31) },
      { fte: project.budgetQ2 || 0, start: new Date(year, 3, 1),  end: new Date(year, 5, 30) },
      { fte: project.budgetQ3 || 0, start: new Date(year, 6, 1),  end: new Date(year, 8, 30) },
      { fte: project.budgetQ4 || 0, start: new Date(year, 9, 1),  end: new Date(year, 11, 31) }
    ];

    // Find Monday of the current week (absolute cutoff — never count beyond today's week)
    var today = new Date(year, now.getMonth(), now.getDate());
    var dayOfWeek = today.getDay();
    var mondayOfCurrentWeek = new Date(today);
    mondayOfCurrentWeek.setDate(today.getDate() - ((dayOfWeek + 6) % 7));

    // Use selected date range, falling back to Jan 1 → current Monday
    var yearStart = startDate ? new Date(startDate + 'T00:00:00') : new Date(year, 0, 1);
    var endBound = endDate ? new Date(new Date(endDate + 'T00:00:00').getTime() + 86400000) : mondayOfCurrentWeek;
    var cutoffDate = endBound < mondayOfCurrentWeek ? endBound : mondayOfCurrentWeek;

    var totalHours = 0;
    for (var i = 0; i < quarterRanges.length; i++) {
      var q = quarterRanges[i];
      if (q.fte === 0) continue;
      // Effective range for this quarter within the YTD window
      var rangeStart = q.start < yearStart ? yearStart : q.start;
      var rangeEnd = q.end >= cutoffDate ? cutoffDate : new Date(q.end.getTime() + 86400000);
      if (rangeStart >= rangeEnd) continue;

      // Count Mondays in [rangeStart, rangeEnd) — each Monday = one completed week
      var d = new Date(rangeStart);
      var dow = d.getDay();
      if (dow !== 1) d.setDate(d.getDate() + ((8 - dow) % 7));
      var weeks = 0;
      while (d < rangeEnd) {
        weeks++;
        d.setDate(d.getDate() + 7);
      }
      totalHours += weeks * q.fte * 40;
    }
    return totalHours;
  }

  let analyticsChartInstance = null;

  function getDateRangeFromPreset(preset) {
    if (preset === 'custom') return null;

    const year = new Date().getFullYear();

    if (preset === 'ytd') {
      return { startDate: year + '-01-01', endDate: new Date().toISOString().slice(0, 10) };
    }
    if (preset === 'q1') return { startDate: year + '-01-01', endDate: year + '-03-31' };
    if (preset === 'q2') return { startDate: year + '-04-01', endDate: year + '-06-30' };
    if (preset === 'q3') return { startDate: year + '-07-01', endDate: year + '-09-30' };
    if (preset === 'q4') return { startDate: year + '-10-01', endDate: year + '-12-31' };

    return { startDate: null, endDate: null };
  }

  function buildAnalyticsUrl(startDate, endDate) {
    let url = '/api/GetProjectAnalytics';
    const params = [];
    if (startDate) params.push('startDate=' + encodeURIComponent(startDate));
    if (endDate) params.push('endDate=' + encodeURIComponent(endDate));
    if (params.length > 0) url += '?' + params.join('&');
    return url;
  }

  async function loadAnalyticsTab(contentEl) {
    contentEl.textContent = '';

    // Restore saved selection
    const savedPreset = localStorage.getItem('analyticsDatePreset') || 'ytd';
    const savedCustomStart = localStorage.getItem('analyticsCustomStart') || '';
    const savedCustomEnd = localStorage.getItem('analyticsCustomEnd') || '';

    // Selector row
    const selectorRow = document.createElement('div');
    selectorRow.className = 'mb-4 flex flex-wrap gap-3 items-center';

    const label = document.createElement('label');
    label.className = 'text-sm font-medium text-slate-700';
    label.textContent = 'Date Range:';

    const select = document.createElement('select');
    select.className = 'px-3 py-2 border rounded text-sm';
    const presets = [
      { value: 'ytd', label: 'Year to Date' },
      { value: 'q1', label: 'Q1 (Jan–Mar)' },
      { value: 'q2', label: 'Q2 (Apr–Jun)' },
      { value: 'q3', label: 'Q3 (Jul–Sep)' },
      { value: 'q4', label: 'Q4 (Oct–Dec)' },
      { value: 'custom', label: 'Custom...' }
    ];
    presets.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.value;
      opt.textContent = p.label;
      if (p.value === savedPreset) opt.selected = true;
      select.appendChild(opt);
    });

    // Custom date pickers (hidden unless Custom is selected)
    const customRow = document.createElement('div');
    customRow.className = 'flex gap-2 items-center' + (savedPreset !== 'custom' ? ' hidden' : '');

    const startInput = document.createElement('input');
    startInput.type = 'date';
    startInput.className = 'px-2 py-1.5 border rounded text-sm';
    startInput.value = savedCustomStart;

    const toLabel = document.createElement('span');
    toLabel.className = 'text-sm text-slate-500';
    toLabel.textContent = 'to';

    const endInput = document.createElement('input');
    endInput.type = 'date';
    endInput.className = 'px-2 py-1.5 border rounded text-sm';
    endInput.value = savedCustomEnd;

    const applyBtn = document.createElement('button');
    applyBtn.className = 'px-3 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700';
    applyBtn.textContent = 'Apply';

    customRow.appendChild(startInput);
    customRow.appendChild(toLabel);
    customRow.appendChild(endInput);
    customRow.appendChild(applyBtn);

    selectorRow.appendChild(label);
    selectorRow.appendChild(select);
    selectorRow.appendChild(customRow);
    contentEl.appendChild(selectorRow);

    // View toggle (Absolute Hours / % of Budget)
    let currentView = 'hours';
    let cachedAnalytics = null;
    let cachedStartDate = null;
    let cachedEndDate = null;

    const toggleRow = document.createElement('div');
    toggleRow.className = 'mb-4 flex items-center border border-gray-300 rounded-lg overflow-hidden shadow-sm w-fit';

    const btnHours = document.createElement('button');
    btnHours.className = 'px-4 py-2 text-sm font-medium border-r border-gray-300 focus:outline-none transition-all duration-200 bg-slate-800 text-white';
    btnHours.textContent = 'Absolute Hours';

    const btnPercent = document.createElement('button');
    btnPercent.className = 'px-4 py-2 text-sm font-medium focus:outline-none transition-all duration-200 bg-white text-slate-500 hover:bg-slate-50';
    btnPercent.textContent = '% of Budget';

    function setActiveToggle(view) {
      currentView = view;
      if (view === 'hours') {
        btnHours.className = 'px-4 py-2 text-sm font-medium border-r border-gray-300 focus:outline-none transition-all duration-200 bg-slate-800 text-white';
        btnPercent.className = 'px-4 py-2 text-sm font-medium focus:outline-none transition-all duration-200 bg-white text-slate-500 hover:bg-slate-50';
      } else {
        btnHours.className = 'px-4 py-2 text-sm font-medium border-r border-gray-300 focus:outline-none transition-all duration-200 bg-white text-slate-500 hover:bg-slate-50';
        btnPercent.className = 'px-4 py-2 text-sm font-medium focus:outline-none transition-all duration-200 bg-slate-800 text-white';
      }
    }

    btnHours.addEventListener('click', () => {
      if (currentView === 'hours') return;
      setActiveToggle('hours');
      if (cachedAnalytics) renderAnalyticsContent(analyticsContent, cachedAnalytics, currentView, cachedStartDate, cachedEndDate);
    });

    btnPercent.addEventListener('click', () => {
      if (currentView === 'percent') return;
      setActiveToggle('percent');
      if (cachedAnalytics) renderAnalyticsContent(analyticsContent, cachedAnalytics, currentView, cachedStartDate, cachedEndDate);
    });

    toggleRow.appendChild(btnHours);
    toggleRow.appendChild(btnPercent);
    contentEl.appendChild(toggleRow);

    // Content area for charts/tables (below selector + toggle)
    const analyticsContent = document.createElement('div');
    contentEl.appendChild(analyticsContent);

    // Fetch and render logic
    async function fetchAndRender() {
      let startDate = null;
      let endDate = null;
      const preset = select.value;

      localStorage.setItem('analyticsDatePreset', preset);

      if (preset === 'custom') {
        startDate = startInput.value || null;
        endDate = endInput.value || null;
        localStorage.setItem('analyticsCustomStart', startDate || '');
        localStorage.setItem('analyticsCustomEnd', endDate || '');

        if (!startDate || !endDate) {
          analyticsContent.textContent = '';
          const hint = document.createElement('div');
          hint.className = 'text-center py-8 text-slate-400';
          hint.textContent = 'Select start and end dates, then click Apply.';
          analyticsContent.appendChild(hint);
          return;
        }
      } else {
        const range = getDateRangeFromPreset(preset);
        if (range) {
          startDate = range.startDate;
          endDate = range.endDate;
        }
      }

      // Show loading
      analyticsContent.textContent = '';
      const loading = document.createElement('div');
      loading.className = 'text-center py-8 text-slate-400';
      loading.textContent = 'Loading analytics...';
      analyticsContent.appendChild(loading);

      try {
        const url = buildAnalyticsUrl(startDate, endDate);
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load analytics');
        const analytics = await response.json();
        cachedAnalytics = analytics;
        cachedStartDate = startDate;
        cachedEndDate = endDate;
        renderAnalyticsContent(analyticsContent, analytics, currentView, startDate, endDate);
      } catch (err) {
        analyticsContent.textContent = '';
        const errDiv = document.createElement('div');
        errDiv.className = 'text-center py-8 text-red-500';
        errDiv.textContent = 'Error loading analytics: ' + err.message;
        analyticsContent.appendChild(errDiv);
      }
    }

    // Event wiring
    select.addEventListener('change', () => {
      if (select.value === 'custom') {
        customRow.classList.remove('hidden');
      } else {
        customRow.classList.add('hidden');
        fetchAndRender();
      }
    });

    applyBtn.addEventListener('click', () => fetchAndRender());

    // Initial fetch
    await fetchAndRender();
  }

  function renderAnalyticsContent(container, analytics, view, startDate, endDate) {
    // Destroy previous chart before clearing DOM to prevent memory leak
    if (analyticsChartInstance) {
      analyticsChartInstance.destroy();
      analyticsChartInstance = null;
    }
    container.textContent = '';

    if (!analytics || analytics.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'text-center py-8 text-slate-400';
      emptyDiv.textContent = 'No analytics data available for this date range.';
      container.appendChild(emptyDiv);
      return;
    }

    // Recalculate budget hours client-side for YTD
    analytics.forEach(function(p) {
      p.budgetHours = calcYtdBudgetHours(p, startDate, endDate);
      p.isOverBudget = p.actualHours > p.budgetHours;
      p.overBy = p.isOverBudget ? p.actualHours - p.budgetHours : 0;
    });

    const sorted = sortProjectsByHours(analytics);
    // Chart.js renders horizontal bars bottom-to-top, so reverse for display
    const displayData = sorted.slice().reverse();

    // --- Chart Card ---
    const chartCard = document.createElement('div');
    chartCard.className = 'bg-white rounded-xl shadow-sm border border-gray-200 p-6';
    const chartWrap = document.createElement('div');
    chartWrap.style.cssText = 'position:relative;width:100%;min-height:480px;';
    const canvas = document.createElement('canvas');
    chartWrap.appendChild(canvas);
    chartCard.appendChild(chartWrap);
    container.appendChild(chartCard);

    if (view === 'hours') {
      // Paired Budget (gray) + Actual (status-colored) bars
      const labels = displayData.map(p => truncateLabel(p.projectName, 32));
      const budgetValues = displayData.map(p => p.budgetHours);
      const actualValues = displayData.map(p => p.actualHours);
      const actualColors = displayData.map(p => getStatusColor(getUtilization(p)));

      analyticsChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'Budget',
              data: budgetValues,
              backgroundColor: '#E5E7EB',
              borderColor: '#D1D5DB',
              borderWidth: 1,
              borderRadius: 3,
              barPercentage: 0.7,
              categoryPercentage: 0.8,
              order: 2
            },
            {
              label: 'Actual',
              data: actualValues,
              backgroundColor: actualColors,
              borderColor: actualColors.slice(),
              borderWidth: 1,
              borderRadius: 3,
              barPercentage: 0.7,
              categoryPercentage: 0.8,
              order: 1
            }
          ]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 600, easing: 'easeInOutQuart' },
          layout: { padding: { right: 20 } },
          scales: {
            x: {
              beginAtZero: true,
              title: { display: true, text: 'Hours', font: { size: 12, weight: '500' }, color: '#6B7280' },
              grid: { color: '#F3F4F6' },
              ticks: { color: '#6B7280', font: { size: 11 } }
            },
            y: {
              grid: { display: false },
              ticks: { color: '#374151', font: { size: 12 } }
            }
          },
          plugins: {
            legend: {
              position: 'top',
              align: 'end',
              labels: {
                usePointStyle: true,
                pointStyle: 'rectRounded',
                padding: 12,
                font: { size: 11 },
                color: '#6B7280',
                generateLabels: function(chart) {
                  return [
                    { text: 'Budget', fillStyle: '#E5E7EB', strokeStyle: '#D1D5DB', lineWidth: 1, pointStyle: 'rectRounded' },
                    { text: 'Actual', fillStyle: '#6B7280', strokeStyle: '#6B7280', lineWidth: 1, pointStyle: 'rectRounded' }
                  ];
                }
              }
            },
            tooltip: {
              backgroundColor: '#1E293B',
              titleFont: { size: 13, weight: '600' },
              bodyFont: { size: 12 },
              padding: 12,
              cornerRadius: 8,
              displayColors: true,
              callbacks: {
                title: function(items) {
                  return displayData[items[0].dataIndex].projectName;
                },
                label: function(context) {
                  return '  ' + context.dataset.label + ': ' + formatNumber(context.parsed.x) + ' hrs';
                },
                afterBody: function(items) {
                  const p = displayData[items[0].dataIndex];
                  const util = getUtilization(p);
                  return ['', 'Utilization: ' + formatUtilPct(util) + ' \u2014 ' + getStatusLabel(util)];
                }
              }
            }
          }
        }
      });
    } else {
      // % of Budget view — single dataset with 100% reference line
      const labels = displayData.map(p => truncateLabel(p.projectName, 32));
      const rawPctValues = displayData.map(p => getUtilization(p) * 100);
      const finitePcts = rawPctValues.filter(v => isFinite(v));
      const capValue = finitePcts.length > 0 ? Math.max.apply(null, finitePcts) * 1.2 : 200;
      const percentValues = rawPctValues.map(v => isFinite(v) ? v : Math.max(capValue, 200));
      const barColors = displayData.map(p => getStatusColor(getUtilization(p)));
      const maxVal = Math.max.apply(null, percentValues);

      analyticsChartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: '% of Budget',
            data: percentValues,
            backgroundColor: barColors,
            borderColor: barColors.slice(),
            borderWidth: 1,
            borderRadius: 3,
            barPercentage: 0.55,
            categoryPercentage: 0.8
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          animation: { duration: 600, easing: 'easeInOutQuart' },
          layout: { padding: { top: 20, right: 20 } },
          scales: {
            x: {
              beginAtZero: true,
              max: Math.ceil(maxVal / 20) * 20 + 10,
              title: { display: true, text: '% of Budget', font: { size: 12, weight: '500' }, color: '#6B7280' },
              grid: { color: '#F3F4F6' },
              ticks: {
                color: '#6B7280',
                font: { size: 11 },
                callback: function(value) { return value + '%'; }
              }
            },
            y: {
              grid: { display: false },
              ticks: { color: '#374151', font: { size: 12 } }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#1E293B',
              titleFont: { size: 13, weight: '600' },
              bodyFont: { size: 12 },
              padding: 12,
              cornerRadius: 8,
              displayColors: false,
              callbacks: {
                title: function(items) {
                  return displayData[items[0].dataIndex].projectName;
                },
                label: function(context) {
                  const p = displayData[context.dataIndex];
                  const util = getUtilization(p);
                  return [
                    'Utilization: ' + formatUtilPct(util),
                    'Actual: ' + formatNumber(p.actualHours) + ' hrs',
                    'Budget: ' + formatNumber(p.budgetHours) + ' hrs',
                    'Status: ' + getStatusLabel(util)
                  ];
                }
              }
            }
          }
        },
        plugins: [{
          id: 'budgetReferenceLine',
          afterDraw: function(chartInstance) {
            const xScale = chartInstance.scales.x;
            if (xScale.max < 100) return; // reference line would be off-screen
            const yScale = chartInstance.scales.y;
            const ctx = chartInstance.ctx;
            const xPos = xScale.getPixelForValue(100);

            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([6, 4]);
            ctx.strokeStyle = '#4B5563';
            ctx.lineWidth = 1.5;
            ctx.moveTo(xPos, yScale.top);
            ctx.lineTo(xPos, yScale.bottom);
            ctx.stroke();

            ctx.setLineDash([]);
            ctx.fillStyle = '#4B5563';
            ctx.font = '500 11px Inter, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('100% Budget', xPos, yScale.top - 8);
            ctx.restore();
          }
        }]
      });
    }

    // --- Project Breakdown Table ---
    const breakdownContainer = document.createElement('div');
    breakdownContainer.className = 'mt-4';
    container.appendChild(breakdownContainer);

    // Group projects by status
    const overProjects = [];
    const approachingProjects = [];
    const onTrackProjects = [];

    sorted.forEach(function(p) {
      const util = getUtilization(p);
      if (util > 1.0) overProjects.push(p);
      else if (util >= 0.8) approachingProjects.push(p);
      else onTrackProjects.push(p);
    });

    const groups = [
      { label: 'Over Budget', projects: overProjects, color: '#EF4444', borderClass: 'border-red-200', textClass: 'text-red-600', badgeBg: '#FEE2E2', tagBg: '#FEF2F2' },
      { label: 'Approaching Budget', projects: approachingProjects, color: '#F59E0B', borderClass: 'border-amber-200', textClass: 'text-amber-600', badgeBg: '#FEF3C7', tagBg: '#FFFBEB' },
      { label: 'On Track', projects: onTrackProjects, color: '#10B981', borderClass: 'border-emerald-200', textClass: 'text-emerald-600', badgeBg: '#D1FAE5', tagBg: '#ECFDF5' }
    ];

    groups.forEach(function(group) {
      if (group.projects.length === 0) return;

      // Section header
      const sectionHeader = document.createElement('div');
      sectionHeader.className = 'flex items-center gap-2 mt-5 mb-2';

      const dot = document.createElement('span');
      dot.style.cssText = 'display:inline-block;width:10px;height:10px;border-radius:50%;background-color:' + group.color;
      sectionHeader.appendChild(dot);

      const sectionTitle = document.createElement('span');
      sectionTitle.className = 'text-sm font-semibold ' + group.textClass;
      sectionTitle.textContent = group.label;
      sectionHeader.appendChild(sectionTitle);

      const countBadge = document.createElement('span');
      countBadge.className = 'text-xs font-medium px-2 py-0.5 rounded-full';
      countBadge.style.backgroundColor = group.badgeBg;
      countBadge.style.color = group.color;
      countBadge.textContent = group.projects.length;
      sectionHeader.appendChild(countBadge);

      breakdownContainer.appendChild(sectionHeader);

      // Project cards
      group.projects.forEach(function(project) {
        const util = getUtilization(project);
        const utilPct = formatUtilPct(util);

        const card = document.createElement('div');
        card.className = 'bg-white rounded-lg border ' + group.borderClass + ' mb-2 overflow-hidden';
        card.style.cssText = 'border-left-width:3px;border-left-color:' + group.color + ';transition:all 0.15s ease;';

        // Card header
        const header = document.createElement('div');
        header.className = 'flex items-center justify-between px-4 py-3 cursor-pointer select-none';

        const headerLeft = document.createElement('div');
        headerLeft.className = 'flex items-center gap-3 min-w-0 flex-1';

        const chevron = document.createElement('span');
        chevron.className = 'chevron-icon text-gray-400 text-xs flex-shrink-0';
        chevron.textContent = '\u25B6';
        headerLeft.appendChild(chevron);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'text-sm font-medium text-gray-800 truncate';
        nameSpan.textContent = project.projectName;
        headerLeft.appendChild(nameSpan);

        // Over-budget tag
        if (project.overBy > 0) {
          const overTag = document.createElement('span');
          overTag.className = 'flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full';
          overTag.style.backgroundColor = group.tagBg;
          overTag.style.color = group.color;
          overTag.textContent = '+' + formatNumber(project.overBy) + ' hrs over';
          headerLeft.appendChild(overTag);
        }

        const headerRight = document.createElement('div');
        headerRight.className = 'flex items-center gap-4 flex-shrink-0 ml-4';

        // Utilization mini bar
        const barWrap = document.createElement('div');
        barWrap.className = 'hidden sm:block';
        barWrap.style.width = '80px';
        const barTrack = document.createElement('div');
        barTrack.className = 'util-bar-track';
        const barFill = document.createElement('div');
        barFill.className = 'util-bar-fill';
        barFill.style.width = Math.min(util * 100, 100) + '%';
        barFill.style.backgroundColor = group.color;
        barTrack.appendChild(barFill);
        barWrap.appendChild(barTrack);
        headerRight.appendChild(barWrap);

        // Hours text
        const hoursText = document.createElement('span');
        hoursText.className = 'text-sm text-gray-500 whitespace-nowrap';
        hoursText.textContent = formatNumber(project.actualHours) + ' / ' + formatNumber(project.budgetHours) + ' hrs';
        headerRight.appendChild(hoursText);

        // Utilization badge
        const utilBadge = document.createElement('span');
        utilBadge.className = 'text-xs font-semibold whitespace-nowrap';
        utilBadge.style.color = group.color;
        utilBadge.textContent = utilPct;
        headerRight.appendChild(utilBadge);

        header.appendChild(headerLeft);
        header.appendChild(headerRight);

        // Card body (expandable)
        const body = document.createElement('div');
        body.className = 'project-card-body px-4 border-t ' + group.borderClass;

        const users = (project.userBreakdown || []).slice().sort(function(a, b) {
          return b.totalHours - a.totalHours;
        });

        const table = document.createElement('table');
        table.className = 'w-full text-sm';

        const thead = document.createElement('thead');
        const headRow = document.createElement('tr');
        headRow.className = 'text-left text-xs font-medium text-gray-500 uppercase tracking-wider';
        ['Engineer', 'Hours', '% of Project'].forEach(function(text) {
          const th = document.createElement('th');
          th.className = 'py-1.5 px-2';
          if (text !== 'Engineer') th.className += ' text-right';
          th.textContent = text;
          headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        users.forEach(function(u) {
          const tr = document.createElement('tr');
          tr.className = 'border-t border-gray-100';

          const nameTd = document.createElement('td');
          nameTd.className = 'py-1.5 px-2 text-gray-700';
          nameTd.textContent = u.displayName || u.userEmail;
          if (u.displayName && u.userEmail) nameTd.title = u.userEmail;

          const hoursTd = document.createElement('td');
          hoursTd.className = 'py-1.5 px-2 text-right font-medium text-gray-800';
          hoursTd.textContent = formatNumber(u.totalHours);

          const sharePct = project.actualHours > 0 ? (u.totalHours / project.actualHours * 100) : 0;
          const shareTd = document.createElement('td');
          shareTd.className = 'py-1.5 px-2 text-right text-gray-500';
          shareTd.textContent = sharePct.toFixed(0) + '%';

          tr.appendChild(nameTd);
          tr.appendChild(hoursTd);
          tr.appendChild(shareTd);
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        body.appendChild(table);

        // Toggle expand/collapse
        header.addEventListener('click', function() {
          body.classList.toggle('open');
          chevron.classList.toggle('open');
        });

        card.appendChild(header);
        card.appendChild(body);
        breakdownContainer.appendChild(card);
      });
    });

    // --- Summary Stats Bar ---
    const summaryBar = document.createElement('div');
    summaryBar.className = 'mt-4 bg-white rounded-lg shadow-sm border border-gray-200 px-5 py-3';
    const summaryInner = document.createElement('div');
    summaryInner.className = 'flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-gray-600';

    let overCount = 0, approachCount = 0, trackCount = 0, totalActual = 0, totalBudget = 0;
    sorted.forEach(function(p) {
      const util = getUtilization(p);
      if (util > 1.0) overCount++;
      else if (util >= 0.8) approachCount++;
      else trackCount++;
      totalActual += p.actualHours;
      totalBudget += p.budgetHours;
    });

    function createStatItem(dotColor, count, label) {
      const span = document.createElement('span');
      span.className = 'flex items-center';
      const dot = document.createElement('span');
      dot.style.cssText = 'display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;background-color:' + dotColor;
      span.appendChild(dot);
      const num = document.createElement('span');
      num.className = 'font-medium text-gray-800';
      num.textContent = count;
      span.appendChild(num);
      span.appendChild(document.createTextNode('\u00A0' + label));
      return span;
    }

    summaryInner.appendChild(createStatItem('#EF4444', overCount, 'over budget'));
    summaryInner.appendChild(createStatItem('#F59E0B', approachCount, 'approaching'));
    summaryInner.appendChild(createStatItem('#10B981', trackCount, 'on track'));

    const divider = document.createElement('span');
    divider.className = 'text-gray-400';
    divider.textContent = '|';
    summaryInner.appendChild(divider);

    const totals = document.createElement('span');
    totals.appendChild(document.createTextNode('Total: '));
    const actualSpan = document.createElement('span');
    actualSpan.className = 'font-medium text-gray-800';
    actualSpan.textContent = formatNumber(totalActual);
    totals.appendChild(actualSpan);
    totals.appendChild(document.createTextNode(' actual / '));
    const budgetSpan = document.createElement('span');
    budgetSpan.className = 'font-medium text-gray-800';
    budgetSpan.textContent = formatNumber(totalBudget);
    totals.appendChild(budgetSpan);
    totals.appendChild(document.createTextNode(' budget hrs'));
    summaryInner.appendChild(totals);

    summaryBar.appendChild(summaryInner);
    container.appendChild(summaryBar);
  }

})();

