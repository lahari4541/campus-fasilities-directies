
(() => {
  const API_BASE = (
    window.CAMPUS_API_BASE ||
    `${window.location.origin}/api`
  ).replace(/\/+$/, '');

  const $ = id => document.getElementById(id);

  const grid = $('facility-grid');
  const messageArea = $('message-area');
  const form = $('facility-form');
  const adminDialog = $('admin-dialog');
  const detailDialog = $('detail-dialog');

  let facilities = [];
  let editingId = null;
  let searchTimer = null;

  const icons = {
    'Academic': '▤',
    'Food & Drink': '☕',
    'Health': '✚',
    'Sports': '↗',
    'Student Services': '♧',
    'Technology': '⌘',
    'Transport': '⇢',
    'Utilities': '⌁',
    'Other': '✳'
  };

  const esc = value =>
    String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);

  async function api(endpoint, options = {}) {
    let response;

    try {
      response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(options.headers || {})
        }
      });
    } catch {
      throw new Error(
        'Could not reach the server. Make sure the backend is running.'
      );
    }

    let payload;

    try {
      payload = await response.json();
    } catch {
      throw new Error(
        `Server returned an unexpected response (HTTP ${response.status}).`
      );
    }

    if (!response.ok || payload.success === false) {
      throw new Error(
        payload.error || `Request failed (HTTP ${response.status}).`
      );
    }

    return payload;
  }

  function showMessage(text, type = 'error') {
    if (!messageArea) return;

    messageArea.innerHTML =
      `<div class="alert ${esc(type)}">${esc(text)}</div>`;

    if (type === 'success') {
      window.setTimeout(() => {
        messageArea.innerHTML = '';
      }, 4500);
    }
  }

  function clearMessage() {
    if (messageArea) messageArea.innerHTML = '';
  }

  function getQuery() {
    const params = new URLSearchParams();

    const q = $('search-input').value.trim();
    const category = $('category-filter').value;
    const status = $('status-filter').value;

    if (q) params.set('q', q);
    if (category !== 'All') params.set('category', category);
    if (status !== 'All') params.set('status', status);

    return params.toString();
  }

  async function loadFacilities() {
    clearMessage();

    grid.innerHTML = `
      <div class="loading-card">
        <span class="spinner"></span>
        <p>Finding your campus essentials…</p>
      </div>
    `;

    $('empty-state').classList.add('hidden');

    try {
      const query = getQuery();

      const payload = await api(
        `/facilities${query ? `?${query}` : ''}`
      );

      facilities = Array.isArray(payload.data) ? payload.data : [];

      $('total-count').textContent = facilities.length;

      $('results-label').textContent =
        `${facilities.length} ${
          facilities.length === 1 ? 'facility' : 'facilities'
        } found`;

      renderFacilities(facilities);
    } catch (error) {
      facilities = [];

      $('total-count').textContent = '—';
      $('results-label').textContent = 'Directory unavailable';

      grid.innerHTML = '';
      $('empty-state').classList.add('hidden');

      showMessage(
        `${error.message} If this is your first run, configure Supabase and run database/schema.sql.`,
        'error'
      );
    }
  }

  function renderFacilities(items) {
    if (!items.length) {
      grid.innerHTML = '';
      $('empty-state').classList.remove('hidden');
      return;
    }

    $('empty-state').classList.add('hidden');

    grid.innerHTML = items.map(item => {
      const statusClass = String(item.status || 'Open').toLowerCase();

      return `
        <article class="facility-card">
          <div class="card-top">
            <span class="facility-icon" aria-hidden="true">
              ${icons[item.category] || '✳'}
            </span>

            <span class="category-pill">
              ${esc(item.category)}
            </span>
          </div>

          <h3>${esc(item.name)}</h3>

          <p class="building-name">
            ${esc(item.building)} · ${esc(item.location)}
          </p>

          <p class="facility-description">
            ${esc(item.description)}
          </p>

          <div class="card-meta">
            <span class="status ${esc(statusClass)}">
              ${esc(item.status || 'Open')}
            </span>

            <div class="card-actions">
              <button
                class="mini-button"
                type="button"
                data-action="details"
                data-id="${esc(item.id)}">
                Details ↗
              </button>

              <button
                class="mini-button"
                type="button"
                data-action="edit"
                data-id="${esc(item.id)}"
                aria-label="Edit ${esc(item.name)}">
                Edit
              </button>

              <button
                class="mini-button"
                type="button"
                data-action="delete"
                data-id="${esc(item.id)}"
                aria-label="Delete ${esc(item.name)}">
                ×
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  function resetFilters() {
    $('search-input').value = '';
    $('category-filter').value = 'All';
    $('status-filter').value = 'All';

    loadFacilities();
  }

  $('reset-filters').addEventListener('click', resetFilters);
  $('empty-reset').addEventListener('click', resetFilters);

  $('search-input').addEventListener('input', () => {
    clearTimeout(searchTimer);

    searchTimer = setTimeout(loadFacilities, 250);
  });

  $('category-filter').addEventListener('change', loadFacilities);
  $('status-filter').addEventListener('change', loadFacilities);

  document.addEventListener('keydown', event => {
    if (
      (event.metaKey || event.ctrlKey) &&
      event.key.toLowerCase() === 'k'
    ) {
      event.preventDefault();
      $('search-input').focus();
    }
  });

  function resetForm() {
    form.reset();

    editingId = null;

    $('facility-id').value = '';
    $('form-title').textContent = 'Add a facility';

    $('save-facility').innerHTML =
      'Save facility <span aria-hidden="true">↗</span>';

    $('form-message').textContent = '';
  }

  function openCreateForm() {
    resetForm();
    adminDialog.showModal();
    $('name').focus();
  }

  function openEditForm(item) {
    resetForm();

    editingId = item.id;

    $('facility-id').value = item.id;
    $('form-title').textContent = 'Edit facility';

    $('save-facility').innerHTML =
      'Save changes <span aria-hidden="true">↗</span>';

    const fields = [
      'name',
      'category',
      'building',
      'location',
      'description',
      'opening_hours',
      'contact',
      'accessibility',
      'status'
    ];

    for (const key of fields) {
      $(key).value = item[key] || '';
    }

    adminDialog.showModal();
    $('name').focus();
  }

  $('open-admin').addEventListener('click', openCreateForm);

  $('close-admin').addEventListener('click', () => {
    adminDialog.close();
  });

  $('cancel-form').addEventListener('click', () => {
    adminDialog.close();
  });

  $('close-detail').addEventListener('click', () => {
    detailDialog.close();
  });

  function showDetails(item) {
    $('detail-content').innerHTML = `
      <div class="detail-head">
        <span class="facility-icon">
          ${icons[item.category] || '✳'}
        </span>

        <h2>${esc(item.name)}</h2>

        <p>
          ${esc(item.category)} · ${esc(item.building)}
        </p>
      </div>

      <p class="detail-description">
        ${esc(item.description)}
      </p>

      <div class="detail-list">
        <div class="detail-row">
          <span>Location</span>
          <span>${esc(item.location)}</span>
        </div>

        <div class="detail-row">
          <span>Status</span>
          <span>${esc(item.status || 'Open')}</span>
        </div>

        <div class="detail-row">
          <span>Opening hours</span>
          <span>${esc(item.opening_hours || 'Not specified')}</span>
        </div>

        <div class="detail-row">
          <span>Contact</span>
          <span>${esc(item.contact || 'Not specified')}</span>
        </div>

        <div class="detail-row">
          <span>Accessibility</span>
          <span>${esc(item.accessibility || 'Not specified')}</span>
        </div>
      </div>
    `;

    detailDialog.showModal();
  }

  grid.addEventListener('click', async event => {
    const button = event.target.closest('button[data-action]');

    if (!button) return;

    const item = facilities.find(
      facility => String(facility.id) === button.dataset.id
    );

    if (!item) return;

    if (button.dataset.action === 'details') {
      showDetails(item);
      return;
    }

    if (button.dataset.action === 'edit') {
      const key = window.prompt(
        'Enter the backend admin write key to edit this facility:'
      );

      if (key === null) return;

      $('admin-key').value = key;

      openEditForm(item);
      return;
    }

    if (button.dataset.action === 'delete') {
      const confirmed = window.confirm(
        `Delete "${item.name}" from the directory? This cannot be undone.`
      );

      if (!confirmed) return;

      const key = window.prompt(
        'Enter the backend admin write key to confirm deletion:'
      );

      if (key === null) return;

      button.disabled = true;

      try {
        await api(
          `/facilities/${encodeURIComponent(item.id)}`,
          {
            method: 'DELETE',
            headers: { 'x-admin-key': key }
          }
        );

        showMessage(`${item.name} was deleted.`, 'success');

        await loadFacilities();
      } catch (error) {
        showMessage(error.message);
        button.disabled = false;
      }
    }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();

    const button = $('save-facility');

    const fields = [
      'name',
      'category',
      'building',
      'location',
      'description',
      'opening_hours',
      'contact',
      'accessibility',
      'status'
    ];

    const payload = {};

    for (const key of fields) {
      payload[key] = $(key).value.trim();
    }

    const adminKey = $('admin-key').value.trim();

    if (!adminKey) {
      $('form-message').textContent =
        'Enter the admin write key before saving.';
      return;
    }

    const wasEditing = editingId !== null;

    const endpoint = wasEditing
      ? `/facilities/${encodeURIComponent(editingId)}`
      : '/facilities';

    button.disabled = true;
    button.textContent = 'Saving…';

    $('form-message').textContent = '';

    try {
      const result = await api(endpoint, {
        method: wasEditing ? 'PATCH' : 'POST',
        headers: { 'x-admin-key': adminKey },
        body: JSON.stringify(payload)
      });

      adminDialog.close();

      resetForm();

      showMessage(result.message || 'Facility saved.', 'success');

      await loadFacilities();
    } catch (error) {
      $('form-message').textContent = error.message;
    } finally {
      button.disabled = false;

      button.innerHTML = editingId
        ? 'Save changes <span aria-hidden="true">↗</span>'
        : 'Save facility <span aria-hidden="true">↗</span>';
    }
  });

  $('year').textContent = new Date().getFullYear();

  loadFacilities();
})();