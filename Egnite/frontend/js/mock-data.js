/*
 * MediCoreDB is now a compatibility facade over the Flask + Oracle backend.
 * The existing page.js files can keep using MediCoreDB.get/update/insert/remove
 * while data is stored in Oracle instead of localStorage.
 *
 * NOTE: requests are synchronous to preserve the original frontend's simple
 * synchronous page code. For a production app, convert page modules to async.
 */
(function (global) {
  const API_BASE = '/api';
  const cache = Object.create(null);

  function token() {
    return sessionStorage.getItem('medicore_token') || '';
  }

  function request(method, path, body) {
    const xhr = new XMLHttpRequest();
    xhr.open(method, API_BASE + path, false);
    xhr.setRequestHeader('Content-Type', 'application/json');
    if (token()) xhr.setRequestHeader('Authorization', 'Bearer ' + token());
    try {
      xhr.send(body === undefined ? null : JSON.stringify(body));
    } catch (e) {
      throw new Error('Cannot reach backend. Start Flask with: python -m backend.app');
    }
    let data = {};
    try { data = xhr.responseText ? JSON.parse(xhr.responseText) : {}; } catch (e) {}
    if (xhr.status < 200 || xhr.status >= 300 || data.success === false) {
      throw new Error(data.message || ('Backend request failed (' + xhr.status + ')'));
    }
    return data;
  }

  function clone(obj) {
    return obj == null ? obj : JSON.parse(JSON.stringify(obj));
  }

  function get(collection) {
    if (cache[collection]) return clone(cache[collection]);
    const response = request('GET', '/db/' + encodeURIComponent(collection));
    cache[collection] = response.data || [];
    return clone(cache[collection]);
  }

  function invalidate(collection) {
    delete cache[collection];
    // Related derived collections.
    if (collection === 'medicineBatches' || collection === 'stockTransactions') delete cache.medicines;
    if (collection === 'instrumentIssues') delete cache.instruments;
    if (collection === 'instrumentMaintenance') delete cache.instruments;
    if (collection === 'consultations' || collection === 'labRequests') delete cache.patients;
  }

  function insert(collection, record) {
    const response = request('POST', '/db/' + encodeURIComponent(collection), record);
    invalidate(collection);
    if (collection === 'appointments') invalidate('appointments');
    return clone(response.data);
  }

  function update(collection, idField, idValue, patch) {
    const response = request('PATCH', '/db/' + encodeURIComponent(collection) + '/' + encodeURIComponent(idValue), patch);
    invalidate(collection);
    return clone(response.data);
  }

  function remove(collection, idField, idValue) {
    request('DELETE', '/db/' + encodeURIComponent(collection) + '/' + encodeURIComponent(idValue));
    invalidate(collection);
    return true;
  }

  function nextId(collection, idField) {
    const response = request('GET', '/db/' + encodeURIComponent(collection) + '/next-id');
    return Number(response.next_id || 1);
  }

  function lookup(collection, idField) {
    const map = {};
    get(collection).forEach(function (r) { map[r[idField]] = r; });
    return map;
  }

  function settings() {
    return clone(request('GET', '/settings').settings || {});
  }

  function updateSettings(patch) {
    const settings = request('PUT', '/settings', patch).settings || {};
    return clone(settings);
  }

  function completeConsultation(payload) {
    const response = request('POST', '/consultations/complete', payload);
    invalidate('consultations');
    invalidate('appointments');
    invalidate('labRequests');
    return clone(response.data);
  }

  function stockIn(payload) {
    const response = request('POST', '/pharmacy/stock/in', payload);
    invalidate('medicineBatches'); invalidate('stockTransactions'); invalidate('medicines');
    return clone(response);
  }

  function stockOut(payload) {
    const response = request('POST', '/pharmacy/stock/out', payload);
    invalidate('medicineBatches'); invalidate('stockTransactions'); invalidate('medicines');
    return clone(response);
  }

  function issueInstrument(payload) {
    const response = request('POST', '/instruments/issue', payload);
    invalidate('instrumentIssues'); invalidate('instruments');
    return clone(response);
  }

  function returnInstrument(payload) {
    const response = request('POST', '/instruments/return', payload);
    invalidate('instrumentIssues'); invalidate('instruments');
    return clone(response);
  }

  function resetAll() {
    throw new Error('Reset is disabled because Oracle is the source of truth.');
  }

  global.MediCoreDB = { get, insert, update, remove, nextId, lookup, settings, updateSettings, completeConsultation, stockIn, stockOut, issueInstrument, returnInstrument, resetAll };
})(window);
