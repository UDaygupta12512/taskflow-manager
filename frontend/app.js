const STAGES = ['Todo', 'In Progress', 'Done'];
const STAGE_CLASS = { Todo: 'todo', 'In Progress': 'progress', Done: 'done' };

const API_BASE =
  window.TASKFLOW_API_URL ||
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000'
    : '');

const state = {
  accessToken: localStorage.getItem('taskflow_access'),
  refreshToken: localStorage.getItem('taskflow_refresh'),
  user: JSON.parse(localStorage.getItem('taskflow_user') || 'null'),
  tasks: [],
  stats: null,
  authMode: 'login',
  editingTaskId: null,
  searchQuery: '',
  loading: false
};

const els = {
  authSection: document.getElementById('authSection'),
  appSection: document.getElementById('appSection'),
  sessionBar: document.getElementById('sessionBar'),
  sessionUser: document.getElementById('sessionUser'),
  userAvatar: document.getElementById('userAvatar'),
  authHeading: document.getElementById('authHeading'),
  authForm: document.getElementById('authForm'),
  authSubmitBtn: document.getElementById('authSubmitBtn'),
  nameField: document.getElementById('nameField'),
  nameInput: document.getElementById('nameInput'),
  emailInput: document.getElementById('emailInput'),
  passwordInput: document.getElementById('passwordInput'),
  togglePassword: document.getElementById('togglePassword'),
  logoutBtn: document.getElementById('logoutBtn'),
  searchInput: document.getElementById('searchInput'),
  newTaskBtn: document.getElementById('newTaskBtn'),
  statsRow: document.getElementById('statsRow'),
  taskBoard: document.getElementById('taskBoard'),
  taskModal: document.getElementById('taskModal'),
  modalTitle: document.getElementById('modalTitle'),
  modalCloseBtn: document.getElementById('modalCloseBtn'),
  taskForm: document.getElementById('taskForm'),
  taskIdInput: document.getElementById('taskIdInput'),
  titleInput: document.getElementById('titleInput'),
  stageInput: document.getElementById('stageInput'),
  priorityInput: document.getElementById('priorityInput'),
  descriptionInput: document.getElementById('descriptionInput'),
  taskSubmitBtn: document.getElementById('taskSubmitBtn'),
  taskCancelBtn: document.getElementById('taskCancelBtn'),
  toastHost: document.getElementById('toastHost'),
  globalLoader: document.getElementById('globalLoader')
};

let searchTimer;
let isRefreshing = false;

function persistSession() {
  if (state.accessToken) localStorage.setItem('taskflow_access', state.accessToken);
  else localStorage.removeItem('taskflow_access');

  if (state.refreshToken) localStorage.setItem('taskflow_refresh', state.refreshToken);
  else localStorage.removeItem('taskflow_refresh');

  if (state.user) localStorage.setItem('taskflow_user', JSON.stringify(state.user));
  else localStorage.removeItem('taskflow_user');
}

function clearSession() {
  state.accessToken = null;
  state.refreshToken = null;
  state.user = null;
  state.tasks = [];
  state.stats = null;
  persistSession();
}

function toast(message, type = '') {
  const node = document.createElement('div');
  node.className = `toast${type ? ` ${type}` : ''}`;
  node.textContent = message;
  els.toastHost.appendChild(node);
  setTimeout(() => node.remove(), 4000);
}

function setLoading(isLoading) {
  state.loading = isLoading;
  els.globalLoader.classList.toggle('hidden', !isLoading);
  els.authSubmitBtn.disabled = isLoading;
  els.taskSubmitBtn.disabled = isLoading;
  els.logoutBtn.disabled = isLoading;
  els.newTaskBtn.disabled = isLoading;
}

async function refreshAccessToken() {
  if (!state.refreshToken || isRefreshing) return false;
  isRefreshing = true;

  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: state.refreshToken })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    state.accessToken = data.accessToken || data.token;
    if (data.refreshToken) state.refreshToken = data.refreshToken;
    if (data.user) state.user = data.user;
    persistSession();
    return true;
  } catch {
    clearSession();
    showAuthView();
    toast('Session expired. Please log in again.', 'error');
    return false;
  } finally {
    isRefreshing = false;
  }
}

async function api(path, options = {}, retry = true) {
  if (!API_BASE) {
    throw new Error('API URL not configured. Set window.TASKFLOW_API_URL in config.js');
  }

  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.accessToken) headers.Authorization = `Bearer ${state.accessToken}`;

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (response.status === 401 && retry && data.code === 'TOKEN_EXPIRED' && state.refreshToken) {
    const ok = await refreshAccessToken();
    if (ok) return api(path, options, false);
  }

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

function setAuthMode(mode) {
  state.authMode = mode;
  document.querySelectorAll('.toggle').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  const isRegister = mode === 'register';
  els.nameField.classList.toggle('hidden', !isRegister);
  els.authHeading.textContent = isRegister ? 'Create account' : 'Welcome back';
  els.authSubmitBtn.textContent = isRegister ? 'Create account' : 'Login';
  els.passwordInput.autocomplete = isRegister ? 'new-password' : 'current-password';
}

function showAuthenticatedView() {
  els.authSection.classList.add('hidden');
  els.appSection.classList.remove('hidden');
  els.sessionBar.classList.remove('hidden');

  const name = state.user?.name || 'User';
  els.sessionUser.textContent = name;
  els.userAvatar.textContent = name.charAt(0).toUpperCase();
}

function showAuthView() {
  els.authSection.classList.remove('hidden');
  els.appSection.classList.add('hidden');
  els.sessionBar.classList.add('hidden');
  closeTaskModal();
}

function openTaskModal(task = null) {
  state.editingTaskId = task?.id || null;
  els.modalTitle.textContent = task ? 'Edit task' : 'New task';
  els.taskIdInput.value = task?.id || '';
  els.titleInput.value = task?.title || '';
  els.descriptionInput.value = task?.description || '';
  els.stageInput.value = task?.stage || 'Todo';
  els.priorityInput.value = String(task?.priority ?? 0);
  els.taskSubmitBtn.textContent = task ? 'Update task' : 'Save task';
  els.taskModal.showModal();
  els.titleInput.focus();
}

function closeTaskModal() {
  if (els.taskModal.open) els.taskModal.close();
  state.editingTaskId = null;
  els.taskForm.reset();
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function renderStats() {
  if (!state.stats) {
    els.statsRow.innerHTML = '';
    return;
  }

  const { total, byStage } = state.stats;
  els.statsRow.innerHTML = `
    <div class="stat-card"><span class="label">Total</span><div class="value">${total}</div></div>
    <div class="stat-card todo"><span class="label">Todo</span><div class="value">${byStage.Todo}</div></div>
    <div class="stat-card progress"><span class="label">In Progress</span><div class="value">${byStage['In Progress']}</div></div>
    <div class="stat-card done"><span class="label">Done</span><div class="value">${byStage.Done}</div></div>
  `;
}

function renderBoard() {
  els.taskBoard.innerHTML = '';

  STAGES.forEach((stage) => {
    const col = document.createElement('section');
    col.className = 'column';
    col.dataset.stage = stage;

    const stageTasks = state.tasks.filter((t) => t.stage === stage);
    const dotClass = STAGE_CLASS[stage];

    col.innerHTML = `
      <div class="column-header">
        <h3><span class="column-dot ${dotClass}"></span>${stage}</h3>
        <span class="count-badge">${stageTasks.length}</span>
      </div>
      <div class="column-body" data-drop-zone="${stage}"></div>
    `;

    const body = col.querySelector('.column-body');
    setupDropZone(body, stage);

    if (!stageTasks.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-col';
      empty.textContent = 'Drop tasks here';
      body.appendChild(empty);
    } else {
      stageTasks.forEach((task) => body.appendChild(createTaskCard(task)));
    }

    els.taskBoard.appendChild(col);
  });
}

function createTaskCard(task) {
  const card = document.createElement('article');
  card.className = `task-card priority-${task.priority || 0}`;
  card.draggable = true;
  card.dataset.id = task.id;

  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', task.id);
    card.classList.add('dragging');
  });
  card.addEventListener('dragend', () => card.classList.remove('dragging'));

  const priorityLabel = ['', 'High', 'Urgent'][task.priority] || '';

  card.innerHTML = `
    <h4>${escapeHtml(task.title)}</h4>
    <p>${escapeHtml(task.description || 'No description')}</p>
    ${priorityLabel ? `<span class="task-meta">⚡ ${priorityLabel}</span>` : ''}
    <span class="task-meta">Updated ${formatDate(task.updatedAt)}</span>
    <div class="task-actions">
      <button type="button" class="btn btn-ghost edit-btn">Edit</button>
      <button type="button" class="btn btn-ghost btn-danger delete-btn">Delete</button>
    </div>
  `;

  card.querySelector('.edit-btn').addEventListener('click', () => openTaskModal(task));
  card.querySelector('.delete-btn').addEventListener('click', () => deleteTask(task.id));

  return card;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function setupDropZone(zone, stage) {
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.closest('.column').classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => {
    zone.closest('.column').classList.remove('drag-over');
  });

  zone.addEventListener('drop', async (e) => {
    e.preventDefault();
    zone.closest('.column').classList.remove('drag-over');
    const taskId = e.dataTransfer.getData('text/plain');
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task || task.stage === stage) return;

    try {
      setLoading(true);
      await api(`/api/tasks/${taskId}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ stage })
      });
      await loadWorkspace();
      toast(`Moved to ${stage}`, 'success');
    } catch (err) {
      toast(err.message, 'error');
      renderBoard();
    } finally {
      setLoading(false);
    }
  });
}

async function loadStats() {
  const data = await api('/api/tasks/stats/summary');
  state.stats = data.stats;
  renderStats();
}

async function loadTasks() {
  const q = state.searchQuery ? `?search=${encodeURIComponent(state.searchQuery)}` : '';
  const data = await api(`/api/tasks${q}`);
  state.tasks = data.tasks || [];
  renderBoard();
}

async function loadWorkspace() {
  await Promise.all([loadTasks(), loadStats()]);
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  setLoading(true);

  const email = els.emailInput.value.trim();
  const password = els.passwordInput.value;

  try {
    if (state.authMode === 'register') {
      await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: els.nameInput.value.trim(), email, password })
      });
      toast('Account created. Log in to continue.', 'success');
      setAuthMode('login');
      els.passwordInput.value = '';
      return;
    }

    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    state.accessToken = data.accessToken || data.token;
    state.refreshToken = data.refreshToken;
    state.user = data.user;
    persistSession();
    showAuthenticatedView();
    toast(`Welcome, ${state.user.name}!`, 'success');
    await loadWorkspace();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setLoading(false);
  }
}

async function handleTaskSubmit(e) {
  e.preventDefault();
  setLoading(true);

  const payload = {
    title: els.titleInput.value.trim(),
    description: els.descriptionInput.value.trim(),
    stage: els.stageInput.value,
    priority: Number(els.priorityInput.value)
  };

  try {
    if (state.editingTaskId) {
      await api(`/api/tasks/${state.editingTaskId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      toast('Task updated.', 'success');
    } else {
      await api('/api/tasks', { method: 'POST', body: JSON.stringify(payload) });
      toast('Task created.', 'success');
    }

    closeTaskModal();
    await loadWorkspace();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setLoading(false);
  }
}

async function deleteTask(taskId) {
  if (!confirm('Delete this task permanently?')) return;

  setLoading(true);
  try {
    await api(`/api/tasks/${taskId}`, { method: 'DELETE' });
    toast('Task deleted.', 'success');
    await loadWorkspace();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setLoading(false);
  }
}

async function handleLogout() {
  setLoading(true);
  try {
    if (state.refreshToken) {
      await api('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: state.refreshToken })
      }).catch(() => {});
    }
  } finally {
    clearSession();
    setLoading(false);
    showAuthView();
    toast('Logged out.', 'success');
  }
}

function bindEvents() {
  document.querySelectorAll('.toggle').forEach((btn) => {
    btn.addEventListener('click', () => setAuthMode(btn.dataset.mode));
  });

  els.authForm.addEventListener('submit', handleAuthSubmit);
  els.taskForm.addEventListener('submit', handleTaskSubmit);
  els.logoutBtn.addEventListener('click', handleLogout);
  els.newTaskBtn.addEventListener('click', () => openTaskModal());
  els.modalCloseBtn.addEventListener('click', closeTaskModal);
  els.taskCancelBtn.addEventListener('click', closeTaskModal);
  els.taskModal.addEventListener('click', (e) => {
    if (e.target === els.taskModal) closeTaskModal();
  });

  els.togglePassword.addEventListener('click', () => {
    const isPassword = els.passwordInput.type === 'password';
    els.passwordInput.type = isPassword ? 'text' : 'password';
    els.togglePassword.textContent = isPassword ? '🙈' : '👁';
  });

  els.searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      state.searchQuery = els.searchInput.value.trim();
      if (!state.accessToken) return;
      try {
        setLoading(true);
        await loadTasks();
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        setLoading(false);
      }
    }, 300);
  });
}

async function init() {
  bindEvents();
  setAuthMode('login');

  if (!API_BASE) {
    toast('Configure API URL in config.js', 'error');
    return;
  }

  if (state.accessToken && state.user) {
    showAuthenticatedView();
    setLoading(true);
    try {
      await api('/api/auth/me');
      await loadWorkspace();
    } catch {
      if (state.refreshToken) {
        const ok = await refreshAccessToken();
        if (ok) {
          await loadWorkspace();
          setLoading(false);
          return;
        }
      }
      clearSession();
      showAuthView();
    } finally {
      setLoading(false);
    }
  } else {
    showAuthView();
  }
}

init();
