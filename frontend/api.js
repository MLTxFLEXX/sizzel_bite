// api.js — SizzleBite Frontend API Client
// Centralizes all fetch() calls to the backend. Never exposes DB credentials.

(function () {
  'use strict';

  const BASE_URL = 'http://localhost:3001/api';

  // ─── Generic fetch wrapper ────────────────────────────────────────────────

  async function apiFetch(endpoint, options = {}) {
    const url = BASE_URL + endpoint;
    const defaults = {
      headers: { 'Content-Type': 'application/json' },
    };
    const config = Object.assign({}, defaults, options, {
      headers: Object.assign({}, defaults.headers, options.headers || {})
    });

    const response = await fetch(url, config);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const msg = data.error || `HTTP ${response.status}`;
      throw new Error(msg);
    }
    return data;
  }

  // ─── Menu API ─────────────────────────────────────────────────────────────

  async function fetchMenu(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiFetch('/menu' + (query ? '?' + query : ''));
  }

  // ─── Orders API ───────────────────────────────────────────────────────────

  async function fetchOrders(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiFetch('/orders' + (query ? '?' + query : ''));
  }

  async function fetchOrder(orderCode) {
    return apiFetch('/orders/' + encodeURIComponent(orderCode));
  }

  async function createOrder(orderData) {
    return apiFetch('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData)
    });
  }

  async function updateOrderStatus(orderCode, status) {
    return apiFetch('/orders/' + encodeURIComponent(orderCode) + '/status', {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  }

  async function deleteOrder(orderCode) {
    return apiFetch('/orders/' + encodeURIComponent(orderCode), {
      method: 'DELETE'
    });
  }

  // ─── Services API ─────────────────────────────────────────────────────────

  async function fetchServices(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiFetch('/services' + (query ? '?' + query : ''));
  }

  async function createServiceRequest(tableNumber, type) {
    return apiFetch('/services', {
      method: 'POST',
      body: JSON.stringify({ tableNumber, type })
    });
  }

  async function resolveServiceRequest(requestCode) {
    return apiFetch('/services/' + encodeURIComponent(requestCode) + '/resolve', {
      method: 'PATCH'
    });
  }

  // ─── Health check ────────────────────────────────────────────────────────

  async function checkHealth() {
    return apiFetch('/health');
  }

  // ─── Export ───────────────────────────────────────────────────────────────

  window.SizzleAPI = {
    fetchMenu,
    fetchOrders,
    fetchOrder,
    createOrder,
    updateOrderStatus,
    deleteOrder,
    fetchServices,
    createServiceRequest,
    resolveServiceRequest,
    checkHealth
  };
})();
