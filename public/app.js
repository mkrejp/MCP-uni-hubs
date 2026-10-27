const pluginCount = document.querySelector('#plugin-count');
const storeCount = document.querySelector('#store-count');
const userCount = document.querySelector('#user-count');
const hubHealth = document.querySelector('#hub-health');
const configList = document.querySelector('#config-list');
const datastoresList = document.querySelector('#datastores-list');
const pluginsList = document.querySelector('#plugins-list');
const storesList = document.querySelector('#stores-list');
const usersTable = document.querySelector('#users-table');
const searchInput = document.querySelector('#user-search');
const emptyUsers = document.querySelector('#empty-users');
const errorBanner = document.querySelector('#error-banner');
const sessionUser = document.querySelector('#session-user');
const sessionLabel = document.querySelector('#session-label');
let allUsers = [];

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function redirectToLogin() {
  window.location.replace('/');
}

function showSessionUser(user) {
  if (!user) {
    sessionUser.hidden = true;
    return;
  }
  const label = user.username || user.email || user.id;
  sessionLabel.textContent = user.email && user.username && user.email !== user.username
    ? `${user.username} · ${user.email}`
    : label;
  sessionUser.hidden = false;
}

function renderConfig(application) {
  const items = [
    ['Application', application.name],
    ['Config source', application.configFile],
    ['Datastore', application.datastore],
    ['Log level', application.logLevel],
  ];
  if (application.instanceId) items.push(['Instance', application.instanceId]);
  configList.replaceChildren(...items.map(([label, value]) => {
    const item = makeElement('div', 'config-item');
    item.append(makeElement('dt', '', label), makeElement('dd', '', value || 'Not set'));
    return item;
  }));
}

function renderPlugins(plugins) {
  if (!plugins.length) {
    pluginsList.replaceChildren(makeElement('div', 'loading-line', 'No plugins loaded.'));
    return;
  }
  pluginsList.replaceChildren(...plugins.map((plugin) => {
    const row = makeElement('div', 'plugin-row');
    const name = makeElement('div', 'plugin-name');
    name.append(makeElement('span', 'plugin-glyph', '⌘'), makeElement('span', '', plugin.name));
    const status = makeElement('span', 'plugin-status');
    status.append(makeElement('span', 'status-pip'), document.createTextNode(plugin.status));
    row.append(name, status);
    return row;
  }));
}

function renderDatastores(datastores) {
  if (!datastores.length) {
    datastoresList.replaceChildren(makeElement('div', 'loading-line', 'No datastores configured.'));
    return;
  }
  datastoresList.replaceChildren(...datastores.map((datastore) => {
    const row = makeElement('div', 'datastore-row');
    row.append(
      makeElement('span', 'datastore-area', datastore.area),
      makeElement('span', `datastore-backend ${datastore.backend === 'PostgreSQL' ? 'sql' : 'local'}`, datastore.backend),
      makeElement('span', 'datastore-location', datastore.location),
    );
    return row;
  }));
}

function renderStores(stores) {
  if (!stores.length) {
    storesList.replaceChildren(makeElement('div', 'loading-line', 'No secret stores configured.'));
    return;
  }
  storesList.replaceChildren(...stores.map((store) => {
    const card = makeElement('article', 'store-card');
    const top = makeElement('div', 'store-top');
    const name = makeElement('div', 'store-name');
    name.append(makeElement('span', 'store-mark', store.name.slice(0, 1).toUpperCase()), makeElement('span', '', store.name));
    top.append(name, makeElement('span', 'configured-tag', store.status.toUpperCase()));
    card.append(top, makeElement('p', 'store-type', store.type));
    card.append(makeElement('div', 'store-endpoint', store.endpoint || 'Endpoint not set'));
    if (store.kvEngine || store.mount) {
      const details = [store.kvEngine, store.mount && `mount: ${store.mount}`].filter(Boolean).join(' · ');
      card.append(makeElement('div', 'store-detail', details));
    }
    return card;
  }));
}

function renderUsers(query = '') {
  const normalizedQuery = query.trim().toLowerCase();
  const filteredUsers = allUsers.filter((user) => [
    user.username,
    user.email,
    user.organizationId,
    ...user.groupIds,
    ...user.roles,
  ].some((value) => value.toLowerCase().includes(normalizedQuery)));

  usersTable.replaceChildren(...filteredUsers.map((user) => {
    const row = document.createElement('tr');
    const identity = document.createElement('td');
    const userCell = makeElement('div', 'user-cell');
    userCell.append(makeElement('span', 'avatar', user.username.slice(0, 1).toUpperCase()));
    const details = document.createElement('div');
    details.append(makeElement('div', 'user-name', user.username));
    if (user.email) details.append(makeElement('div', 'user-email', user.email));
    userCell.append(details);
    identity.append(userCell);
    row.append(identity, makeElement('td', '', user.organizationId || '—'));

    for (const values of [user.groupIds, user.roles]) {
      const cell = document.createElement('td');
      const pills = makeElement('div', 'pill-list');
      for (const value of values.length ? values : ['—']) pills.append(makeElement('span', 'pill', value));
      cell.append(pills);
      row.append(cell);
    }
    return row;
  }));
  emptyUsers.hidden = filteredUsers.length !== 0;
}

async function loadDashboard() {
  const refreshButton = document.querySelector('#refresh-button');
  refreshButton.disabled = true;
  errorBanner.hidden = true;
  try {
    const response = await fetch('/api/dashboard', { cache: 'no-store', credentials: 'same-origin' });
    if (response.status === 401) {
      redirectToLogin();
      return;
    }
    if (!response.ok) throw new Error('Dashboard data request failed.');
    const data = await response.json();

    pluginCount.textContent = String(data.plugins.length);
    storeCount.textContent = String(data.stores.length);
    userCount.textContent = String(data.users.length);
    hubHealth.textContent = `${data.hubStatus.healthy}/${data.hubStatus.total}`;
    renderConfig(data.application);
    renderDatastores(data.datastores);
    renderPlugins(data.plugins);
    renderStores(data.stores);
    allUsers = data.users;
    renderUsers(searchInput.value);
    document.querySelector('#last-updated').textContent = `UPDATED ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    document.querySelector('#footer-instance').textContent = data.application.instanceId || 'LOCAL CONTROL PLANE';
  } catch (error) {
    errorBanner.textContent = `${error.message} Check the application server and try again.`;
    errorBanner.hidden = false;
  } finally {
    refreshButton.disabled = false;
  }
}

async function bootstrap() {
  try {
    const response = await fetch('/api/me', { cache: 'no-store', credentials: 'same-origin' });
    if (response.status === 401) {
      redirectToLogin();
      return;
    }
    if (!response.ok) {
      throw new Error('Unable to verify session.');
    }
    const me = await response.json();
    showSessionUser(me.user);
    await loadDashboard();
  } catch (error) {
    errorBanner.textContent = `${error.message} Check the application server and try again.`;
    errorBanner.hidden = false;
  }
}

document.querySelector('#refresh-button').addEventListener('click', loadDashboard);
searchInput.addEventListener('input', () => renderUsers(searchInput.value));
bootstrap();
