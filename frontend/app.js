// SizzleBite Dine-in Table Ordering Application Logic
(function() {
  'use strict';

  // --- AUDIO SYNTHESIZER (Web Audio API) ---
  class SoundEffects {
    constructor() {
      this.ctx = null;
      this.enabled = true;
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    playChime() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, this.ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.3);
    }

    playOrderBell() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      [784, 1046.5].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.12);
        gain.gain.setValueAtTime(0.2, now + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.45);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.5);
      });
    }

    playSuccessCelebration() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.09);
        gain.gain.setValueAtTime(0.18, now + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 0.4);
      });
    }
  }

  const sfx = new SoundEffects();

  // --- CURRENCY FORMATTER (INR) ---
  const inrFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  });

  function formatPrice(amount) {
    return inrFormatter.format(amount || 0);
  }

  let activeTrackedOrderId = null;

  // --- STATE MANAGEMENT ---
  const state = {
    activeTable: 4, // Default table if none in URL
    currentView: 'customer', // 'customer' | 'kds'
    activeCategory: 'all',
    searchQuery: '',
    dietaryFilter: 'all',
    cart: [],
    selectedTipPercent: 0.15,
    customizingItem: null,
    activeOrders: [],
    serviceRequests: [],
    showResolvedServices: false,
    broadcast: null,
    isSubmittingOrder: false
  };

  // --- INITIALIZATION ---
  function initApp() {
    setupURLTable();
    loadStoredData();
    setupBroadcast();
    setupEventListeners();
    renderCategories();
    renderMenuGrid();
    updateCartUI();
    renderKDS();
    checkActiveTableOrder();
    renderServiceAlertsInKDS();

    // Hydrate menu dynamically from backend API if available
    if (window.SizzleAPI && typeof window.SizzleAPI.fetchMenu === 'function') {
      window.SizzleAPI.fetchMenu().then(data => {
        if (data && Array.isArray(data.items) && data.items.length > 0) {
          MENU_DATA.items = data.items;
          if (Array.isArray(data.categories) && data.categories.length > 0) {
            MENU_DATA.categories = data.categories;
          }
          renderCategories();
          renderMenuGrid();
        }
      }).catch(() => {
        // Fallback gracefully to data.js without interrupting the user
      });
    }

    // Hydrate real orders dynamically from backend PostgreSQL database
    if (window.SizzleAPI && typeof window.SizzleAPI.fetchOrders === 'function') {
      window.SizzleAPI.fetchOrders().then(data => {
        if (data && Array.isArray(data.orders)) {
          if (data.orders.length > 0) {
            state.activeOrders = data.orders;
            saveOrders();
            renderKDS();
            checkActiveTableOrder();
          }
        }
      }).catch(err => {
        console.warn("Backend orders sync error:", err);
      });
    }

    // Hydrate service requests from backend on load (persists across refresh)
    if (window.SizzleAPI && typeof window.SizzleAPI.fetchServices === 'function') {
      window.SizzleAPI.fetchServices({ status: 'all' }).then(data => {
        if (data && Array.isArray(data.requests) && data.requests.length > 0) {
          const localById = {};
          state.serviceRequests.forEach(r => { localById[r.id] = r; });
          state.serviceRequests = data.requests.map(r => ({
            ...r,
            status: r.status || (localById[r.id] && localById[r.id].status) || (r.handled ? 'resolved' : 'pending')
          }));
          saveServices();
          renderServiceAlertsInKDS();
        }
      }).catch(err => {
        console.warn("Backend services sync error:", err);
      });
    }

    // Periodic timer tick for KDS elapsed minutes & live order tracking
    let pollCount = 0;
    setInterval(() => {
      updateKDSTicketTimes();
      updateCustomerOrderTimer();
      pollCount++;
      // Auto-refresh active order in tracker every 5 seconds if modal is open
      if (pollCount % 5 === 0) {
        const trackerModal = document.getElementById('orderTrackerModal');
        if (trackerModal && trackerModal.classList.contains('active') && activeTrackedOrderId && window.SizzleAPI) {
          window.SizzleAPI.fetchOrder(activeTrackedOrderId).then(live => {
            if (live && live.id) {
              const idx = state.activeOrders.findIndex(o => o.id === live.id);
              if (idx > -1) state.activeOrders[idx] = live;
              else state.activeOrders.unshift(live);
              saveOrders();
              checkActiveTableOrder();
              renderTrackerContent(live);
            }
          }).catch(() => {});
        }
      }
      // Re-poll service requests from DB every 8 seconds for real-time KDS updates
      if (pollCount % 8 === 0 && window.SizzleAPI && typeof window.SizzleAPI.fetchServices === 'function') {
        window.SizzleAPI.fetchServices({ status: 'all' }).then(data => {
          if (data && Array.isArray(data.requests)) {
            const localById = {};
            state.serviceRequests.forEach(r => { localById[r.id] = r; });
            state.serviceRequests = data.requests.map(r => ({
              ...r,
              status: r.status || (localById[r.id] && localById[r.id].status) || (r.handled ? 'resolved' : 'pending')
            }));
            saveServices();
            renderServiceAlertsInKDS();
          }
        }).catch(() => {});
      }
    }, 1000);
  }

  // Detect table from URL parameter (e.g. ?table=5)
  function setupURLTable() {
    const params = new URLSearchParams(window.location.search);
    const tableParam = params.get('table');
    if (tableParam) {
      const parsed = parseInt(tableParam, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= MENU_DATA.restaurant.totalTables) {
        state.activeTable = parsed;
      }
    }
    updateTableBadges();
  }

  function updateTableBadges() {
    document.querySelectorAll('.active-table-num').forEach(el => {
      el.textContent = state.activeTable;
    });
  }

  // LocalStorage & Cross-Tab Broadcast Channel
  function loadStoredData() {
    try {
      const savedOrders = localStorage.getItem('sizzle_orders');
      if (savedOrders) {
        state.activeOrders = JSON.parse(savedOrders);
        // Refresh stale demo orders if saved in old USD (subtotal < 100)
        if (state.activeOrders.some(o => o.subtotal < 100) && window.INITIAL_DEMO_DATA) {
          state.activeOrders = window.INITIAL_DEMO_DATA.activeOrders;
          saveOrders();
        }
      } else if (window.INITIAL_DEMO_DATA) {
        state.activeOrders = window.INITIAL_DEMO_DATA.activeOrders;
        saveOrders();
      }

      const savedServices = localStorage.getItem('sizzle_services');
      if (savedServices) {
        state.serviceRequests = JSON.parse(savedServices);
      } else if (window.INITIAL_DEMO_DATA) {
        state.serviceRequests = window.INITIAL_DEMO_DATA.serviceRequests;
        saveServices();
      }

      const savedCart = localStorage.getItem(`sizzle_cart_tbl_${state.activeTable}`);
      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);
        // Clear stale USD cart items (< 100)
        if (parsedCart.some(i => i.totalPrice < 100)) {
          state.cart = [];
          saveCart();
        } else {
          state.cart = parsedCart;
        }
      }
    } catch (e) {
      console.warn("Storage access error:", e);
    }
  }

  function saveOrders() {
    localStorage.setItem('sizzle_orders', JSON.stringify(state.activeOrders));
  }

  function saveServices() {
    localStorage.setItem('sizzle_services', JSON.stringify(state.serviceRequests));
  }

  function saveCart() {
    localStorage.setItem(`sizzle_cart_tbl_${state.activeTable}`, JSON.stringify(state.cart));
  }

  function setupBroadcast() {
    if ('BroadcastChannel' in window) {
      state.broadcast = new BroadcastChannel('sizzle_channel');
      state.broadcast.onmessage = (event) => {
        handleBroadcastEvent(event.data);
      };
    }

    window.addEventListener('storage', (e) => {
      if (e.key === 'sizzle_orders') {
        state.activeOrders = JSON.parse(e.newValue || '[]');
        renderKDS();
        checkActiveTableOrder();
      } else if (e.key === 'sizzle_services') {
        state.serviceRequests = JSON.parse(e.newValue || '[]');
        renderServiceAlertsInKDS();
      }
    });
  }

  function handleBroadcastEvent(data) {
    if (!data) return;
    if (data.type === 'NEW_ORDER') {
      loadStoredData();
      renderKDS();
      if (state.currentView === 'kds') {
        sfx.playOrderBell();
        showToast(`🔔 New Order from Table ${data.order.tableNumber}!`);
      }
    } else if (data.type === 'STATUS_UPDATE') {
      loadStoredData();
      renderKDS();
      if (data.tableNumber === state.activeTable) {
        checkActiveTableOrder();
        if (data.status === 'ready') {
          sfx.playSuccessCelebration();
          showToast("🎉 Your delicious food is READY and on its way to your table!");
        } else if (data.status === 'cooking') {
          showToast("👨‍🍳 The kitchen has started cooking your order!");
        } else if (data.status === 'served') {
          showToast("🍔 Your meal has been served! Enjoy your food!");
        }
      }
    } else if (data.type === 'SERVICE_REQUEST') {
      loadStoredData();
      renderServiceAlertsInKDS();
      if (state.currentView === 'kds') {
        sfx.playOrderBell();
        showToast(`🛎️ Table ${data.tableNumber}: ${data.text}`);
      }
    }
  }

  function broadcast(payload) {
    if (state.broadcast) {
      try {
        state.broadcast.postMessage(payload);
      } catch (err) {
        console.warn("Broadcast postMessage error:", err);
      }
    }
  }

  // --- RENDERING CATEGORIES & MENU ---
  function renderCategories() {
    const scroller = document.getElementById('categoryScroller');
    if (!scroller) return;
    scroller.innerHTML = MENU_DATA.categories.map(cat => `
      <button class="category-tab-btn ${state.activeCategory === cat.id ? 'active' : ''}" data-cat="${cat.id}">
        <span>${cat.icon}</span>
        <span>${cat.name}</span>
      </button>
    `).join('');

    scroller.querySelectorAll('.category-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.activeCategory = btn.dataset.cat;
        document.querySelectorAll('.category-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderMenuGrid();
      });
    });
  }

  // Image resolver with fallback
  function getMenuItemImage(idOrName) {
    if (!idOrName) return 'images/placeholder-food.svg';
    const found = (window.MENU_DATA && window.MENU_DATA.items)
      ? window.MENU_DATA.items.find(i => i.id === idOrName || i.name === idOrName)
      : null;
    return (found && found.image) ? found.image : 'images/placeholder-food.svg';
  }

  function renderMenuGrid() {
    const grid = document.getElementById('menuGrid');
    const titleEl = document.getElementById('menuSectionTitle');
    const countEl = document.getElementById('menuSectionCount');
    if (!grid) return;

    let items = MENU_DATA.items;

    // Filter by Category
    if (state.activeCategory !== 'all') {
      items = items.filter(i => i.category === state.activeCategory);
      const catObj = MENU_DATA.categories.find(c => c.id === state.activeCategory);
      if (titleEl) titleEl.textContent = catObj ? `${catObj.icon} ${catObj.name}` : "Menu Items";
    } else {
      if (titleEl) titleEl.textContent = "🔥 Full Fast Food Menu";
    }

    // Filter by Search
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase();
      items = items.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
      );
    }

    // Filter by Dietary
    if (state.dietaryFilter === 'veg') {
      items = items.filter(i => i.isVeg);
    } else if (state.dietaryFilter === 'spicy') {
      items = items.filter(i => i.isSpicy);
    } else if (state.dietaryFilter === 'chef') {
      items = items.filter(i => i.isChefSpecial);
    }

    if (countEl) countEl.textContent = `${items.length} dishes available`;

    if (items.length === 0) {
      grid.innerHTML = `
        <div class="empty-menu-state" style="grid-column: 1 / -1;">
          <span class="emoji">🍔🔍</span>
          <h3>No mouthwatering items found</h3>
          <p>Try searching for burgers, fries, shakes, or clear your filters.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = items.map(item => {
      const hasCustomizations = item.customizations && Object.keys(item.customizations).length > 0;
      return `
        <article class="food-card" data-item-id="${item.id}">
          <div class="food-image-wrapper">
            <img src="${item.image}" alt="${item.name}" class="food-img" loading="lazy" onerror="this.onerror=null; this.src='images/placeholder-food.svg';" />
            <div class="card-badges">
              ${item.isChefSpecial ? '<span class="badge badge-chef">Chef Special</span>' : ''}
              ${item.isPopular ? '<span class="badge badge-popular">★ Bestseller</span>' : ''}
              ${item.isSpicy ? '<span class="badge badge-spicy">🌶️ Spicy</span>' : ''}
              ${item.isVeg ? '<span class="badge badge-veg">🌱 Veg</span>' : ''}
            </div>
            <div class="prep-time-badge">⏱️ ${item.prepTime}</div>
          </div>
          <div class="food-card-body">
            <div class="food-card-header">
              <h3 class="food-title">${item.name}</h3>
              <span class="food-price">${formatPrice(item.price)}</span>
            </div>
            <p class="food-description">${item.description}</p>
            <div class="food-meta-row">
              <span class="food-calories">${item.calories} kcal</span>
              ${hasCustomizations ? `
                <button class="btn-customize-food" data-action="customize" data-id="${item.id}">
                  <span>⚙️ Customize</span>
                </button>
              ` : `
                <button class="btn-add-food" data-action="quick-add" data-id="${item.id}">
                  <span>+ Add to Table</span>
                </button>
              `}
            </div>
          </div>
        </article>
      `;
    }).join('');

    // Attach card click handlers
    grid.querySelectorAll('[data-action="quick-add"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        quickAddItem(btn.dataset.id);
      });
    });

    grid.querySelectorAll('[data-action="customize"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openCustomizer(btn.dataset.id);
      });
    });

    grid.querySelectorAll('.food-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.itemId;
        openCustomizer(id);
      });
    });
  }

  // Quick Add for items without mandatory options
  function quickAddItem(itemId) {
    const item = MENU_DATA.items.find(i => i.id === itemId);
    if (!item) return;

    addToCart({
      menuItemId: item.id,
      name: item.name,
      basePrice: item.price,
      totalPrice: item.price,
      quantity: 1,
      image: item.image,
      customizationsText: "Standard Chef Prep",
      instructions: ""
    });

    sfx.playChime();
    showToast(`Added ${item.name} to Table ${state.activeTable}!`);
  }

  // --- ITEM CUSTOMIZATION MODAL ---
  function openCustomizer(itemId) {
    const item = MENU_DATA.items.find(i => i.id === itemId);
    if (!item) return;

    state.customizingItem = item;
    const modal = document.getElementById('customizerModal');
    const container = document.getElementById('customizerContent');
    if (!modal || !container) return;

    let optionsHTML = '';

    if (item.customizations && Object.keys(item.customizations).length > 0) {
      for (const [key, group] of Object.entries(item.customizations)) {
        optionsHTML += `
          <div class="custom-option-group" data-group="${key}" data-type="${group.type}">
            <div class="option-group-title">
              <span>${group.title}</span>
              ${group.required ? '<span class="option-badge-required">Required</span>' : ''}
            </div>
            <div class="custom-options-list">
              ${group.options.map((opt, idx) => `
                <label class="custom-option-row">
                  <div class="custom-option-label">
                    <input 
                      type="${group.type}" 
                      name="opt_${key}" 
                      value="${opt.name}" 
                      data-price="${opt.price}"
                      ${group.type === 'radio' && idx === 0 ? 'checked' : ''} 
                    />
                    <span>${opt.name}</span>
                  </div>
                  ${opt.price > 0 ? `<span class="custom-option-price">+${formatPrice(opt.price)}</span>` : '<span class="custom-option-price" style="color:var(--text-subtle);">Free</span>'}
                </label>
              `).join('')}
            </div>
          </div>
        `;
      }
    } else {
      optionsHTML = `
        <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1rem;">
          This item is served with the chef's signature recipe. Add any custom preparation notes below!
        </p>
      `;
    }

    container.innerHTML = `
      <div class="customizer-item-preview">
        <img src="${item.image}" alt="${item.name}" class="customizer-img" onerror="this.onerror=null; this.src='images/placeholder-food.svg';" />
        <div class="customizer-details">
          <h3>${item.name}</h3>
          <p>${item.description}</p>
          <div style="margin-top: 0.5rem; font-weight: 800; color: var(--primary);">
            Base Price: ${formatPrice(item.price)}
          </div>
        </div>
      </div>

      <div class="custom-options-container">
        ${optionsHTML}
      </div>

      <div style="margin-top: 1.25rem;">
        <label style="display:block; font-size: 0.85rem; font-weight: 700; margin-bottom: 0.4rem;">
          Special Table Requests / Allergies:
        </label>
        <textarea 
          id="customizerNotes" 
          class="special-instruction-box" 
          placeholder="e.g. No pickles, dressing on the side, extra crispy fries..." 
          rows="2"
        ></textarea>
      </div>
    `;

    // Calculate initial dynamic price
    updateCustomizerTotal();

    // Bind listeners to option inputs
    container.querySelectorAll('input').forEach(input => {
      input.addEventListener('change', updateCustomizerTotal);
    });

    modal.classList.add('active');
  }

  function updateCustomizerTotal() {
    if (!state.customizingItem) return;
    let total = state.customizingItem.price;
    const container = document.getElementById('customizerContent');
    const totalDisplay = document.getElementById('customizerTotalPrice');

    container.querySelectorAll('input:checked').forEach(input => {
      const price = parseFloat(input.dataset.price || 0);
      total += price;
    });

    if (totalDisplay) {
      totalDisplay.textContent = formatPrice(total);
    }
  }

  function handleAddCustomizedToCart() {
    if (!state.customizingItem) return;
    const item = state.customizingItem;
    const container = document.getElementById('customizerContent');
    const notes = document.getElementById('customizerNotes')?.value.trim() || '';

    let extraPrice = 0;
    const selectedMods = [];

    container.querySelectorAll('input:checked').forEach(input => {
      const p = parseFloat(input.dataset.price || 0);
      extraPrice += p;
      if (p > 0) {
        selectedMods.push(`${input.value} (+${formatPrice(p)})`);
      } else {
        selectedMods.push(input.value);
      }
    });

    addToCart({
      menuItemId: item.id,
      name: item.name,
      basePrice: item.price,
      totalPrice: item.price + extraPrice,
      quantity: 1,
      image: item.image,
      customizationsText: selectedMods.join(', ') || 'Standard',
      instructions: notes
    });

    sfx.playChime();
    closeModal('customizerModal');
    showToast(`Added ${item.name} to Table ${state.activeTable}!`);
  }

  // --- CART OPERATIONS ---
  function addToCart(cartItem) {
    // Check if an identical item exists (same id + same mods + same notes)
    const existingIndex = state.cart.findIndex(i => 
      i.menuItemId === cartItem.menuItemId &&
      i.customizationsText === cartItem.customizationsText &&
      i.instructions === cartItem.instructions
    );

    if (existingIndex > -1) {
      state.cart[existingIndex].quantity += 1;
    } else {
      cartItem.id = 'ci_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
      state.cart.push(cartItem);
    }

    saveCart();
    updateCartUI();
  }

  function updateItemQuantity(cartItemId, delta) {
    const item = state.cart.find(i => i.id === cartItemId);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
      state.cart = state.cart.filter(i => i.id !== cartItemId);
    }

    saveCart();
    updateCartUI();
  }

  function removeCartItem(cartItemId) {
    state.cart = state.cart.filter(i => i.id !== cartItemId);
    saveCart();
    updateCartUI();
  }

  function clearCart() {
    state.cart = [];
    saveCart();
    updateCartUI();
  }

  function updateCartUI() {
    const totalItems = state.cart.reduce((sum, i) => sum + i.quantity, 0);
    const subtotal = state.cart.reduce((sum, i) => sum + (i.totalPrice * i.quantity), 0);
    const tax = subtotal * MENU_DATA.restaurant.taxRate;
    const tip = subtotal > 0 ? subtotal * state.selectedTipPercent : 0;
    const total = subtotal + tax + tip;

    // Badges & Floater
    document.querySelectorAll('.cart-item-count-badge').forEach(el => {
      el.textContent = totalItems;
    });

    const floater = document.getElementById('mobileCartFloater');
    if (floater) {
      if (totalItems > 0) {
        floater.classList.add('visible');
        document.getElementById('floaterItemCount').textContent = totalItems;
        document.getElementById('floaterTotal').textContent = `${formatPrice(total)} ➔`;
      } else {
        floater.classList.remove('visible');
      }
    }

    // Cart Drawer List
    const cartList = document.getElementById('cartItemsList');
    if (!cartList) return;

    if (state.cart.length === 0) {
      cartList.innerHTML = `
        <div class="cart-empty-prompt">
          <div style="font-size: 3rem; margin-bottom: 0.75rem;">🛒</div>
          <h4>Your table order is empty</h4>
          <p style="font-size:0.825rem; color:var(--text-muted); margin-top:0.35rem;">
            Explore our juicy smash burgers, crispy chicken, and shakes to add to Table #${state.activeTable}!
          </p>
        </div>
      `;
    } else {
      cartList.innerHTML = state.cart.map(item => `
        <div class="cart-item-card">
          <img src="${item.image || getMenuItemImage(item.menuItemId || item.name)}" alt="${item.name}" class="cart-item-thumb" onerror="this.onerror=null; this.src='images/placeholder-food.svg';" />
          <div class="cart-item-info">
            <h4 class="cart-item-title">${item.name}</h4>
            <div class="cart-item-modifiers">${item.customizationsText}</div>
            ${item.instructions ? `<div class="cart-item-notes">Note: "${item.instructions}"</div>` : ''}
            <div class="cart-item-price">${formatPrice(item.totalPrice * item.quantity)}</div>
          </div>
          <div class="cart-item-actions">
            <div class="qty-pill">
              <button class="qty-btn" onclick="window.sizzleApp.changeQty('${item.id}', -1)">-</button>
              <span class="qty-value">${item.quantity}</span>
              <button class="qty-btn" onclick="window.sizzleApp.changeQty('${item.id}', 1)">+</button>
            </div>
            <button class="btn-remove-item" onclick="window.sizzleApp.removeItem('${item.id}')">Remove</button>
          </div>
        </div>
      `).join('');
    }

    // Bill summary
    const subtotalEl = document.getElementById('cartSubtotal');
    const taxEl = document.getElementById('cartTax');
    const tipEl = document.getElementById('cartTip');
    const totalEl = document.getElementById('cartTotal');
    const checkoutBtn = document.getElementById('btnProceedCheckout');

    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
    if (taxEl) taxEl.textContent = formatPrice(tax);
    if (tipEl) tipEl.textContent = formatPrice(tip);
    if (totalEl) totalEl.textContent = formatPrice(total);

    if (checkoutBtn) {
      checkoutBtn.disabled = totalItems === 0;
      checkoutBtn.style.opacity = totalItems === 0 ? '0.5' : '1';
    }
  }

  // --- CHECKOUT & ORDER SUBMISSION ---
  function openCheckoutModal() {
    if (state.cart.length === 0) return;
    const modal = document.getElementById('checkoutModal');
    if (!modal) return;

    const subtotal = state.cart.reduce((sum, i) => sum + (i.totalPrice * i.quantity), 0);
    const tax = subtotal * MENU_DATA.restaurant.taxRate;
    const tip = subtotal * state.selectedTipPercent;
    const total = subtotal + tax + tip;

    document.getElementById('checkoutTableNum').textContent = state.activeTable;
    document.getElementById('checkoutTotalAmount').textContent = formatPrice(total);

    closeCartDrawer();
    modal.classList.add('active');
  }

  async function submitOrder() {
    if (state.cart.length === 0) return;
    if (state.isSubmittingOrder) return;

    const btnConfirm = document.getElementById('btnConfirmOrder');
    const originalBtnText = btnConfirm ? btnConfirm.innerHTML : 'Send Order to Kitchen 🔥';

    state.isSubmittingOrder = true;
    if (btnConfirm) {
      btnConfirm.disabled = true;
      btnConfirm.innerHTML = '<span>Sending to Kitchen... 🔥</span>';
    }

    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'pay_at_table';
    const subtotal = state.cart.reduce((sum, i) => sum + (i.totalPrice * i.quantity), 0);
    const tax = subtotal * MENU_DATA.restaurant.taxRate;
    const tip = subtotal * state.selectedTipPercent;
    const total = subtotal + tax + tip;

    const payload = {
      tableNumber: state.activeTable,
      items: state.cart.map(i => ({
        menuItemId: i.menuItemId,
        name: i.name,
        basePrice: i.basePrice,
        totalPrice: i.totalPrice,
        quantity: i.quantity,
        customizationsText: i.customizationsText,
        instructions: i.instructions
      })),
      paymentMethod: paymentMethod,
      tip: tip
    };

    let confirmedOrder = null;

    try {
      if (window.SizzleAPI && typeof window.SizzleAPI.createOrder === 'function') {
        confirmedOrder = await window.SizzleAPI.createOrder(payload);
      } else {
        // SizzleAPI not available — cannot place order
        showToast('⚠️ Cannot reach the kitchen server. Please try again.');
      }
    } catch (err) {
      console.error("Backend order creation error:", err);
      showToast(`⚠️ Order failed: ${err.message || 'Could not reach server. Please try again.'}`);
    }

    // Abort if backend did not return a valid saved order — never generate a fake ID
    if (!confirmedOrder || !confirmedOrder.id) {
      if (btnConfirm) {
        btnConfirm.disabled = false;
        btnConfirm.innerHTML = originalBtnText;
      }
      state.isSubmittingOrder = false;
      return;
    }

    // Authoritative ID: exact order ID returned by the backend response
    activeTrackedOrderId = confirmedOrder.id;
    localStorage.setItem('sizzle_active_order_id', confirmedOrder.id);

    // Update in-memory orders
    const existingIdx = state.activeOrders.findIndex(o => o.id === confirmedOrder.id);
    if (existingIdx > -1) {
      state.activeOrders[existingIdx] = confirmedOrder;
    } else {
      state.activeOrders.unshift(confirmedOrder);
    }

    saveOrders();
    clearCart();

    // Broadcast to KDS / other tabs
    broadcast({
      type: 'NEW_ORDER',
      order: confirmedOrder
    });

    sfx.playOrderBell();
    closeModal('checkoutModal');
    showToast(`Order #${confirmedOrder.id} successfully sent to the kitchen!`);

    if (btnConfirm) {
      btnConfirm.disabled = false;
      btnConfirm.innerHTML = originalBtnText;
    }
    state.isSubmittingOrder = false;

    // Check active order banner & update KDS
    checkActiveTableOrder();
    renderKDS();

    // Open Live Order Tracker with the exact backend order ID
    openOrderTracker(confirmedOrder.id);
  }

  // --- LIVE ORDER TRACKER ---
  function checkActiveTableOrder() {
    let currentOrder = state.activeOrders.find(o => o.tableNumber === state.activeTable && o.status !== 'served');
    if (!currentOrder) {
      const activeStoredId = localStorage.getItem('sizzle_active_order_id');
      if (activeStoredId) {
        currentOrder = state.activeOrders.find(o => o.id === activeStoredId && o.status !== 'served');
      }
    }

    const banner = document.getElementById('activeOrderBanner');
    if (banner) {
      if (currentOrder) {
        banner.style.display = 'flex';
        document.getElementById('bannerOrderId').textContent = currentOrder.id;
        document.getElementById('bannerOrderStatus').textContent = getStatusText(currentOrder.status);
      } else {
        banner.style.display = 'none';
      }
    }
  }

  function getStatusText(status) {
    switch(status) {
      case 'received': return '📝 Order Received';
      case 'cooking': return '👨‍🍳 Sizzling on Grill';
      case 'ready': return '🛎️ Plated & Ready';
      case 'served': return '🍔 Served at Table';
      default: return status;
    }
  }

  async function openOrderTracker(orderId) {
    const modal = document.getElementById('orderTrackerModal');
    const content = document.getElementById('orderTrackerContent');
    if (!modal || !content) return;

    // Resolve target order ID
    let targetId = orderId;
    if (!targetId) {
      const activeForTable = state.activeOrders.find(o => o.tableNumber === state.activeTable && o.status !== 'served');
      if (activeForTable) {
        targetId = activeForTable.id;
      }
    }
    if (!targetId) {
      targetId = localStorage.getItem('sizzle_active_order_id');
    }

    if (!targetId) {
      showToast("No active orders found for this table.");
      return;
    }

    activeTrackedOrderId = targetId;
    modal.classList.add('active');

    // Display clean loading indicator
    content.innerHTML = `
      <div style="text-align:center; padding:3rem 1.5rem;">
        <div style="font-size:2.5rem; margin-bottom:0.75rem;">⏳</div>
        <h4 style="font-size:1.1rem; font-weight:700; color:var(--text-bright); margin-bottom:0.4rem;">
          Connecting to Kitchen Live Database...
        </h4>
        <p style="font-size:0.85rem; color:var(--text-muted);">
          Retrieving live status for Order <strong style="color:var(--primary);">${targetId}</strong>
        </p>
      </div>
    `;

    // Fetch the real order from PostgreSQL via GET /api/orders/:orderCode
    try {
      if (window.SizzleAPI && typeof window.SizzleAPI.fetchOrder === 'function') {
        const liveOrder = await window.SizzleAPI.fetchOrder(targetId);
        if (liveOrder && liveOrder.id) {
          // Sync with state.activeOrders
          const idx = state.activeOrders.findIndex(o => o.id === liveOrder.id);
          if (idx > -1) {
            state.activeOrders[idx] = liveOrder;
          } else {
            state.activeOrders.unshift(liveOrder);
          }
          saveOrders();
          checkActiveTableOrder();
          renderTrackerContent(liveOrder);
          return;
        } else {
          throw new Error(`Order ${targetId} could not be retrieved`);
        }
      } else {
        // Fallback to local state if SizzleAPI wrapper not found
        const localOrder = state.activeOrders.find(o => o.id === targetId);
        if (localOrder) {
          renderTrackerContent(localOrder);
        } else {
          renderTrackerError(targetId, "Order not found in database.");
        }
      }
    } catch (err) {
      console.error(`Live Kitchen Tracker error for ${targetId}:`, err);
      // Check if local cache has an offline copy
      const localCopy = state.activeOrders.find(o => o.id === targetId);
      if (localCopy) {
        renderTrackerContent(localCopy, `Showing local copy (${err.message})`);
      } else {
        renderTrackerError(targetId, err.message || "Order not found in PostgreSQL database");
      }
    }
  }

  function renderTrackerError(orderId, errorMsg) {
    const content = document.getElementById('orderTrackerContent');
    if (!content) return;

    content.innerHTML = `
      <div style="text-align:center; padding: 2.5rem 1.5rem; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.25); border-radius: var(--radius-lg); margin-bottom: 1rem;">
        <div style="font-size: 3rem; margin-bottom: 0.75rem;">⚠️</div>
        <h4 style="font-size: 1.15rem; font-weight: 800; color: #ef4444; margin-bottom: 0.5rem;">
          Order Not Found
        </h4>
        <p style="font-size: 0.875rem; color: var(--text-muted); max-width: 420px; margin: 0 auto 1.25rem;">
          Could not retrieve <strong>${orderId || 'requested order'}</strong> from the kitchen database.
        </p>
        <div style="font-family: monospace; font-size: 0.8rem; background: var(--bg-dark); padding: 0.6rem 1rem; border-radius: var(--radius-sm); color: #fca5a5; display: inline-block; margin-bottom: 1.5rem; border: 1px solid rgba(255,255,255,0.08);">
          ${errorMsg}
        </div>
        <div style="display:flex; justify-content:center; gap:0.75rem;">
          <button class="btn-icon-soft" onclick="window.sizzleApp.openOrderTracker('${orderId}')">
            🔄 Retry
          </button>
          <button class="btn-cart-header" onclick="window.sizzleApp.closeModal('orderTrackerModal')">
            Close
          </button>
        </div>
      </div>
    `;
  }

  function renderTrackerContent(order) {
    const content = document.getElementById('orderTrackerContent');
    if (!content) return;

    const steps = [
      { id: 'received', title: 'Order Received', desc: 'Sent straight to our kitchen line', icon: '📝' },
      { id: 'cooking', title: 'Sizzling on the Grill', desc: 'Fresh patties & fries being prepared', icon: '👨‍🍳' },
      { id: 'ready', title: 'Plated & Ready', desc: 'Order is being brought to Table #' + order.tableNumber, icon: '🛎️' },
      { id: 'served', title: 'Delivered to Table', desc: 'Enjoy your fresh gourmet fast food!', icon: '🍔' }
    ];

    const statusOrder = ['received', 'cooking', 'ready', 'served'];
    const currentIndex = statusOrder.indexOf(order.status);

    content.innerHTML = `
      <div class="order-tracker-card">
        <div class="tracker-order-id">
          <span>Order ${order.id}</span>
          <span style="font-size:0.85rem; color:var(--accent-gold); font-weight:700;">Table #${order.tableNumber}</span>
        </div>
        <div class="tracker-timestamp">
          Placed ${new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • 
          Payment: ${order.paymentMethod === 'instant_card' ? '💳 Paid Online' : '💵 Pay at Table'}
        </div>

        <div class="stepper-container">
          ${steps.map((step, idx) => {
            let stepClass = '';
            if (idx < currentIndex) stepClass = 'completed';
            else if (idx === currentIndex) stepClass = 'current';
            return `
              <div class="step-node ${stepClass}">
                <div class="step-icon-circle">
                  ${idx < currentIndex ? '✓' : step.icon}
                </div>
                <div class="step-content">
                  <h5>${step.title}</h5>
                  <p>${step.desc}</p>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="eta-box">
          <div>
            <div class="eta-label">Estimated Service Time</div>
            <div style="font-size:0.75rem; color:var(--text-subtle);">Directly to Table #${order.tableNumber}</div>
          </div>
          <div class="eta-time" id="trackerEta">${order.status === 'served' ? 'Delivered!' : '4-7 mins'}</div>
        </div>
      </div>

      <div style="background:var(--bg-card); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:1rem; margin-bottom:1rem;">
        <h4 style="font-size:0.9rem; font-weight:700; margin-bottom:0.75rem; display:flex; justify-content:space-between;">
          <span>Itemized Table Receipt</span>
          <span style="color:var(--primary);">${formatPrice(order.total)}</span>
        </h4>
        <div style="font-size: 0.825rem; display:flex; flex-direction:column; gap:0.65rem;">
          ${order.items.map(it => `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:0.75rem;">
              <div style="display:flex; align-items:center; gap:0.65rem;">
                <img src="${it.image || getMenuItemImage(it.id || it.name)}" alt="${it.name}" class="order-item-thumb" onerror="this.onerror=null; this.src='images/placeholder-food.svg';" />
                <div>
                  <strong>${it.quantity}x</strong> ${it.name}
                  <div style="font-size:0.75rem; color:var(--text-muted);">${it.customizationsText}</div>
                </div>
              </div>
              <div style="font-weight:700; color:var(--text-bright);">${formatPrice(it.price * it.quantity)}</div>
            </div>
          `).join('')}
        </div>
        <div style="border-top:1px dashed var(--border-subtle); margin-top:0.75rem; padding-top:0.5rem; font-size:0.775rem; color:var(--text-muted); display:flex; justify-content:space-between;">
          <span>Subtotal: ${formatPrice(order.subtotal)} | Tax: ${formatPrice(order.tax)} | Tip: ${formatPrice(order.tip)}</span>
        </div>
      </div>

      <div style="display:flex; gap:0.75rem;">
        <button class="btn-icon-soft" style="flex:1; justify-content:center;" onclick="window.print()">
          <span>🖨️ Print Receipt</span>
        </button>
        <button class="btn-cart-header" style="flex:1; justify-content:center;" onclick="window.sizzleApp.closeTrackerAndShop()">
          <span>+ Order More Items</span>
        </button>
      </div>
    `;
  }

  function updateCustomerOrderTimer() {
    const etaEl = document.getElementById('trackerEta');
    if (!etaEl) return;
    const currentOrder = state.activeOrders.find(o => o.tableNumber === state.activeTable && o.status !== 'served');
    if (currentOrder) {
      const elapsedMins = Math.floor((Date.now() - currentOrder.createdAt) / 60000);
      const remaining = Math.max(1, currentOrder.estimatedTime - elapsedMins);
      etaEl.textContent = `${remaining} mins`;
    }
  }

  // --- KITCHEN DISPLAY SYSTEM (KDS) ---
  function renderKDS() {
    const kdsView = document.getElementById('kdsView');
    if (!kdsView) return;

    const columns = {
      received: document.getElementById('kdsReceivedTickets'),
      cooking: document.getElementById('kdsCookingTickets'),
      ready: document.getElementById('kdsReadyTickets'),
      served: document.getElementById('kdsServedTickets')
    };

    const counts = {
      received: document.getElementById('countReceived'),
      cooking: document.getElementById('countCooking'),
      ready: document.getElementById('countReady'),
      served: document.getElementById('countServed')
    };

    const ordersByStatus = {
      received: [],
      cooking: [],
      ready: [],
      served: []
    };

    state.activeOrders.forEach(ord => {
      if (ordersByStatus[ord.status]) {
        ordersByStatus[ord.status].push(ord);
      }
    });

    for (const [status, container] of Object.entries(columns)) {
      if (!container) continue;
      const orders = ordersByStatus[status];
      if (counts[status]) counts[status].textContent = orders.length;

      if (orders.length === 0) {
        container.innerHTML = `
          <div style="text-align:center; padding: 2rem 1rem; color:var(--text-subtle); font-size:0.85rem;">
            No tickets
          </div>
        `;
        continue;
      }

      container.innerHTML = orders.map(ord => {
        const elapsedMins = Math.floor((Date.now() - ord.createdAt) / 60000);
        const isUrgent = elapsedMins >= 10 && ord.status !== 'served';

        let nextActionBtn = '';
        if (ord.status === 'received') {
          nextActionBtn = `<button class="kds-btn-action" onclick="window.sizzleApp.advanceOrderStatus('${ord.id}', 'cooking')">👨‍🍳 Start Cooking</button>`;
        } else if (ord.status === 'cooking') {
          nextActionBtn = `<button class="kds-btn-action" style="background:var(--accent-gold); color:#000;" onclick="window.sizzleApp.advanceOrderStatus('${ord.id}', 'ready')">🛎️ Mark Ready</button>`;
        } else if (ord.status === 'ready') {
          nextActionBtn = `<button class="kds-btn-action" style="background:var(--accent-green); color:#fff;" onclick="window.sizzleApp.advanceOrderStatus('${ord.id}', 'served')">✓ Mark Served</button>`;
        }

        return `
          <div class="kds-ticket ${isUrgent ? 'urgent' : ''}" data-ticket-id="${ord.id}">
            <div class="kds-ticket-header">
              <span class="kds-ticket-table">Table #${ord.tableNumber}</span>
              <span class="kds-ticket-timer" data-created="${ord.createdAt}">⏱️ ${elapsedMins}m ago</span>
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted); display:flex; justify-content:space-between;">
              <span>Ticket ${ord.id}</span>
              <span>${ord.paymentMethod === 'instant_card' ? '💳 Paid' : '💵 Unpaid'}</span>
            </div>
            <div class="kds-ticket-items">
              ${ord.items.map(it => `
                <div class="kds-ticket-item">
                  <span class="kds-ticket-item-qty">${it.quantity}x</span>
                  <strong>${it.name}</strong>
                  ${it.customizationsText ? `<span class="kds-ticket-item-mod">• ${it.customizationsText}</span>` : ''}
                  ${it.instructions ? `<span class="kds-ticket-item-mod" style="color:var(--accent-gold); font-weight:600;">⚠️ NOTE: ${it.instructions}</span>` : ''}
                </div>
              `).join('')}
            </div>
            <div class="kds-ticket-actions">
              ${nextActionBtn}
              <button class="btn-dismiss-alert" title="Cancel/Delete Ticket" onclick="window.sizzleApp.cancelOrder('${ord.id}')">✕</button>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  function advanceOrderStatus(orderId, newStatus) {
    const order = state.activeOrders.find(o => o.id === orderId);
    if (!order) return;

    order.status = newStatus;
    saveOrders();
    renderKDS();

    // Sync status with PostgreSQL backend
    if (window.SizzleAPI && typeof window.SizzleAPI.updateOrderStatus === 'function') {
      window.SizzleAPI.updateOrderStatus(order.id, newStatus).catch(err => {
        console.warn("Backend order status update error:", err);
      });
    }

    broadcast({
      type: 'STATUS_UPDATE',
      orderId: order.id,
      tableNumber: order.tableNumber,
      status: newStatus
    });

    if (newStatus === 'ready') {
      sfx.playSuccessCelebration();
    } else {
      sfx.playChime();
    }

    // If customer is on the same screen/table
    if (order.tableNumber === state.activeTable) {
      checkActiveTableOrder();
      const trackerModal = document.getElementById('orderTrackerModal');
      if (trackerModal && trackerModal.classList.contains('active')) {
        renderTrackerContent(order);
      }
    }
  }

  function cancelOrder(orderId) {
    if (!confirm(`Are you sure you want to cancel ticket ${orderId}?`)) return;
    state.activeOrders = state.activeOrders.filter(o => o.id !== orderId);
    saveOrders();
    renderKDS();
    checkActiveTableOrder();

    // Sync cancellation with PostgreSQL backend
    if (window.SizzleAPI && typeof window.SizzleAPI.deleteOrder === 'function') {
      window.SizzleAPI.deleteOrder(orderId).catch(err => {
        console.warn("Backend order delete error:", err);
      });
    }

    showToast(`Ticket ${orderId} cancelled.`);
  }

  function updateKDSTicketTimes() {
    document.querySelectorAll('.kds-ticket-timer').forEach(el => {
      const created = parseInt(el.dataset.created, 10);
      if (created) {
        const mins = Math.floor((Date.now() - created) / 60000);
        el.textContent = `⏱️ ${mins}m ago`;
        const ticket = el.closest('.kds-ticket');
        if (ticket && mins >= 10 && !ticket.classList.contains('urgent')) {
          ticket.classList.add('urgent');
        }
      }
    });
  }

  // --- SERVICE ASSISTANT / CALL WAITER ---
  function sendServiceRequest(typeId) {
    const srv = MENU_DATA.restaurant.serviceCallTypes.find(s => s.id === typeId);
    const label = srv ? srv.label : "Call Server";

    // Optimistic local state (shown immediately in KDS with Pending status while API call is in-flight)
    const tempId = "SRV-" + Math.floor(100 + Math.random() * 900);
    const localRequest = {
      id: tempId,
      tableNumber: state.activeTable,
      type: typeId,
      text: label,
      status: 'pending',
      time: Date.now(),
      handled: false
    };

    state.serviceRequests.unshift(localRequest);
    saveServices();
    renderServiceAlertsInKDS();

    // ── Send to backend (Neon PostgreSQL via /api/services) ──────────────────
    if (window.SizzleAPI && typeof window.SizzleAPI.createServiceRequest === 'function') {
      window.SizzleAPI.createServiceRequest(state.activeTable, typeId)
        .then(saved => {
          // Replace temp local entry with real DB record
          const idx = state.serviceRequests.findIndex(s => s.id === tempId);
          const finalItem = {
            id:          saved.id,
            dbId:        saved.dbId,
            tableNumber: saved.tableNumber,
            type:        saved.type,
            text:        saved.text || label,
            status:      saved.status || 'pending',
            time:        saved.time || Date.now(),
            handled:     saved.handled || false
          };
          if (idx !== -1) {
            state.serviceRequests[idx] = finalItem;
          } else {
            state.serviceRequests.unshift(finalItem);
          }
          saveServices();
          renderServiceAlertsInKDS();

          sfx.playOrderBell();
          showToast(`✅ Request Confirmed: Table #${saved.tableNumber} — ${saved.text || label} is now Pending Staff attention.`);

          broadcast({
            type: 'SERVICE_REQUEST',
            id: saved.id,
            tableNumber: saved.tableNumber,
            text: saved.text || label,
            status: 'pending'
          });
        })
        .catch(err => {
          console.error('Service request API error:', err);
          // Remove optimistic entry on failure so UI accurately reflects DB state
          state.serviceRequests = state.serviceRequests.filter(s => s.id !== tempId);
          saveServices();
          renderServiceAlertsInKDS();
          showToast(`⚠️ Could not save request "${label}" for Table #${state.activeTable}: ${err.message || 'network error'}. Please try again.`);
        });
    } else {
      // Backend unavailable fallback
      sfx.playOrderBell();
      showToast(`✅ Request Sent: Table #${state.activeTable} — ${label} is Pending.`);
      broadcast({
        type: 'SERVICE_REQUEST',
        id: tempId,
        tableNumber: state.activeTable,
        text: label,
        status: 'pending'
      });
    }

    closeModal('serviceModal');
  }

  function renderServiceAlertsInKDS() {
    const container = document.getElementById('kdsServiceAlerts');
    if (!container) return;

    // Separate into active (pending, accepted) and resolved
    const active = state.serviceRequests.filter(s => !s.handled && s.status !== 'resolved');
    const resolved = state.serviceRequests.filter(s => s.handled || s.status === 'resolved');

    if (active.length === 0 && resolved.length === 0) {
      container.innerHTML = '';
      return;
    }

    const TYPE_ICONS = {
      water:   '💧', napkins: '🧻', sauces: '🥫', waiter: '👨‍💼', bill: '🧾'
    };

    let html = '';

    if (active.length > 0) {
      html += active.map(s => {
        const icon        = TYPE_ICONS[s.type] || '🛎️';
        const minsAgo     = Math.floor((Date.now() - (s.time || Date.now())) / 60000);
        const timeLabel   = minsAgo < 1 ? 'just now' : `${minsAgo}m ago`;
        const isAccepted  = s.status === 'accepted';
        const statusPill  = isAccepted
          ? `<span class="srv-status-pill srv-accepted">✓ Accepted</span>`
          : `<span class="srv-status-pill srv-pending">● Pending</span>`;

        const acceptBtn = !isAccepted
          ? `<button class="srv-btn srv-btn-accept"
                onclick="window.sizzleApp.acceptService('${s.id}')"
                title="Acknowledge request — staff on the way">
               👍 Accept
             </button>`
          : '';

        return `
          <div class="service-call-card ${isAccepted ? 'srv-card-accepted' : 'srv-card-pending'}"
               data-srv-id="${s.id}">
            <div class="srv-card-left">
              <span class="srv-type-icon">${icon}</span>
              <div class="srv-card-body">
                <div class="srv-card-title">
                  <strong>Table #${s.tableNumber}</strong>
                  <span class="srv-card-type">${s.text}</span>
                </div>
                <div class="srv-card-meta">
                  ${statusPill}
                  <span class="srv-time">${timeLabel}</span>
                </div>
              </div>
            </div>
            <div class="srv-card-actions">
              ${acceptBtn}
              <button class="srv-btn srv-btn-resolve"
                  onclick="window.sizzleApp.dismissService('${s.id}')"
                  title="Mark as resolved">
                ✓ Mark as Resolved
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

    if (resolved.length > 0) {
      const toggleLabel = state.showResolvedServices
        ? '▲ Hide Resolved History'
        : `▼ View Resolved History (${resolved.length})`;

      html += `
        <div style="width: 100%; display: flex; align-items: center; justify-content: space-between; margin-top: 0.5rem;">
          <span style="font-size: 0.75rem; color: var(--text-muted);">
            Active Calls: <strong>${active.length}</strong> | Resolved Today: <strong>${resolved.length}</strong>
          </span>
          <button class="srv-history-toggle" onclick="window.sizzleApp.toggleResolvedServices()">
            ${toggleLabel}
          </button>
        </div>
      `;

      if (state.showResolvedServices) {
        html += resolved.slice(0, 10).map(s => {
          const icon      = TYPE_ICONS[s.type] || '🛎️';
          const minsAgo   = Math.floor((Date.now() - (s.time || Date.now())) / 60000);
          const timeLabel = minsAgo < 1 ? 'just now' : `${minsAgo}m ago`;

          return `
            <div class="service-call-card srv-card-resolved" data-srv-id="${s.id}">
              <div class="srv-card-left">
                <span class="srv-type-icon">${icon}</span>
                <div class="srv-card-body">
                  <div class="srv-card-title">
                    <strong>Table #${s.tableNumber}</strong>
                    <span class="srv-card-type">${s.text}</span>
                  </div>
                  <div class="srv-card-meta">
                    <span class="srv-status-pill srv-resolved">✓ Resolved</span>
                    <span class="srv-time">${timeLabel}</span>
                  </div>
                </div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    container.innerHTML = html;
  }

  function acceptService(srvId) {
    const srv = state.serviceRequests.find(s => s.id === srvId);
    if (!srv || srv.status === 'accepted') return;
    srv.status = 'accepted';
    srv.handled = false;
    saveServices();
    renderServiceAlertsInKDS();

    // Persist status change to database
    if (window.SizzleAPI && typeof window.SizzleAPI.acceptServiceRequest === 'function') {
      window.SizzleAPI.acceptServiceRequest(srvId)
        .then(updated => {
          if (updated && updated.status) {
            srv.status = updated.status;
            saveServices();
            renderServiceAlertsInKDS();
          }
        })
        .catch(err => {
          console.warn('Backend accept service error:', err);
        });
    }

    broadcast({
      type: 'SERVICE_STATUS_CHANGE',
      id: srvId,
      status: 'accepted',
      tableNumber: srv.tableNumber
    });

    showToast(`👍 Accepted: Table #${srv.tableNumber} ${srv.text} — staff on the way!`);
  }

  function dismissService(srvId) {
    const srv = state.serviceRequests.find(s => s.id === srvId);
    if (srv) {
      srv.handled = true;
      srv.status = 'resolved';
      srv.handledAt = Date.now();
      saveServices();
      renderServiceAlertsInKDS();

      // Persist resolved status to backend (request_code matches SRV-xxx format)
      if (window.SizzleAPI && typeof window.SizzleAPI.resolveServiceRequest === 'function') {
        window.SizzleAPI.resolveServiceRequest(srvId)
          .then(updated => {
            if (updated) {
              srv.handled = updated.handled !== undefined ? updated.handled : true;
              srv.status = updated.status || 'resolved';
              saveServices();
              renderServiceAlertsInKDS();
            }
          })
          .catch(err => {
            console.warn('Backend resolve service error:', err);
          });
      }

      broadcast({
        type: 'SERVICE_STATUS_CHANGE',
        id: srvId,
        status: 'resolved',
        tableNumber: srv.tableNumber
      });

      showToast(`✓ Resolved: Table #${srv.tableNumber} ${srv.text} marked as resolved.`);
    }
  }

  function toggleResolvedServices() {
    state.showResolvedServices = !state.showResolvedServices;
    renderServiceAlertsInKDS();
  }

  // --- TABLE SWITCHING & QR CODE MODAL ---
  function changeTable(newTableNum) {
    state.activeTable = newTableNum;
    // Update URL without reload
    const url = new URL(window.location);
    url.searchParams.set('table', newTableNum);
    window.history.replaceState({}, '', url);

    loadStoredData();
    updateTableBadges();
    updateCartUI();
    checkActiveTableOrder();
    closeModal('tablePickerModal');
    showToast(`Switched to Table #${newTableNum}!`);
  }

  function openTableQRModal() {
    const modal = document.getElementById('qrGeneratorModal');
    const grid = document.getElementById('qrCodesGrid');
    if (!modal || !grid) return;

    // Generate table cards 1 to 12
    const currentOrigin = window.location.origin + window.location.pathname;
    grid.innerHTML = Array.from({ length: MENU_DATA.restaurant.totalTables }, (_, i) => i + 1).map(num => {
      const tableUrl = `${currentOrigin}?table=${num}`;
      // Clean inline SVG representation of QR code pattern
      const qrSvg = `
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="100" height="100" fill="white"/>
          <rect x="10" y="10" width="25" height="25" fill="#111"/>
          <rect x="15" y="15" width="15" height="15" fill="white"/>
          <rect x="18" y="18" width="9" height="9" fill="#ff5722"/>
          
          <rect x="65" y="10" width="25" height="25" fill="#111"/>
          <rect x="70" y="15" width="15" height="15" fill="white"/>
          <rect x="73" y="18" width="9" height="9" fill="#ff5722"/>
          
          <rect x="10" y="65" width="25" height="25" fill="#111"/>
          <rect x="15" y="70" width="15" height="15" fill="white"/>
          <rect x="18" y="73" width="9" height="9" fill="#ff5722"/>
          
          <rect x="42" y="12" width="12" height="6" fill="#111"/>
          <rect x="42" y="24" width="6" height="12" fill="#111"/>
          <rect x="42" y="42" width="16" height="16" fill="#ff5722"/>
          <rect x="65" y="42" width="10" height="10" fill="#111"/>
          <rect x="12" y="45" width="18" height="6" fill="#111"/>
          <rect x="42" y="65" width="12" height="12" fill="#111"/>
          <rect x="62" y="65" width="8" height="25" fill="#111"/>
          <rect x="75" y="75" width="15" height="15" fill="#111"/>
        </svg>
      `;

      return `
        <div class="qr-table-card" onclick="window.sizzleApp.changeTable(${num}); window.sizzleApp.closeModal('qrGeneratorModal');">
          <div class="qr-code-box">
            ${qrSvg}
          </div>
          <div class="qr-table-number">Table #${num}</div>
          <a href="${tableUrl}" class="table-pill-action" onclick="event.stopPropagation(); window.sizzleApp.changeTable(${num}); window.sizzleApp.closeModal('qrGeneratorModal'); return false;">
            Simulate Scan
          </a>
        </div>
      `;
    }).join('');

    modal.classList.add('active');
  }

  // --- UI CONTROLS & EVENT BINDINGS ---
  function setupEventListeners() {
    // Mode toggle (Customer View vs Kitchen KDS Display)
    const btnToggleMode = document.getElementById('btnToggleMode');
    if (btnToggleMode) {
      btnToggleMode.addEventListener('click', toggleViewMode);
    }

    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        renderMenuGrid();
      });
    }

    // Dietary filters
    document.querySelectorAll('.dietary-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.dietary-btn').forEach(b => b.classList.remove('active'));
        const filter = btn.dataset.filter;
        if (state.dietaryFilter === filter) {
          state.dietaryFilter = 'all';
        } else {
          state.dietaryFilter = filter;
          btn.classList.add('active');
        }
        renderMenuGrid();
      });
    });

    // Header Cart Button & Floater
    document.getElementById('btnOpenCart')?.addEventListener('click', openCartDrawer);
    document.getElementById('mobileCartFloater')?.addEventListener('click', openCartDrawer);
    document.getElementById('btnCloseCart')?.addEventListener('click', closeCartDrawer);
    document.getElementById('cartDrawerOverlay')?.addEventListener('click', closeCartDrawer);

    // Tip selection
    document.querySelectorAll('.tip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tip-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.selectedTipPercent = parseFloat(btn.dataset.tip);
        updateCartUI();
      });
    });

    // Proceed to Checkout
    document.getElementById('btnProceedCheckout')?.addEventListener('click', openCheckoutModal);
    document.getElementById('btnConfirmOrder')?.addEventListener('click', submitOrder);

    // Customizer Modal
    document.getElementById('btnConfirmCustomizer')?.addEventListener('click', handleAddCustomizedToCart);
    document.getElementById('btnCloseCustomizer')?.addEventListener('click', () => closeModal('customizerModal'));

    // Modals close triggers
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
      overlay.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', () => overlay.classList.remove('active'));
      });
    });

    // Sound toggle
    document.getElementById('btnToggleSound')?.addEventListener('click', () => {
      sfx.enabled = !sfx.enabled;
      const soundIcon = document.getElementById('soundIcon');
      if (soundIcon) soundIcon.textContent = sfx.enabled ? '🔊' : '🔇';
      showToast(sfx.enabled ? 'Sound alerts enabled' : 'Sound alerts muted');
    });

    // Active order banner click
    document.getElementById('activeOrderBanner')?.addEventListener('click', () => {
      const bannerId = document.getElementById('bannerOrderId')?.textContent?.trim();
      openOrderTracker(bannerId || undefined);
    });

    // Quick Service Chips
    document.querySelectorAll('.service-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        // Brief visual feedback: dim while sending, then restore
        chip.classList.add('sending');
        setTimeout(() => chip.classList.remove('sending'), 1200);
        sendServiceRequest(chip.dataset.service);
      });
    });
  }

  function toggleViewMode() {
    const customerView = document.getElementById('customerView');
    const kdsView = document.getElementById('kdsView');
    const modeBtn = document.getElementById('btnToggleMode');

    if (state.currentView === 'customer') {
      state.currentView = 'kds';
      customerView.style.display = 'none';
      kdsView.style.display = 'block';
      if (modeBtn) modeBtn.innerHTML = '<span>📱 Return to Customer View</span>';
      renderKDS();
      renderServiceAlertsInKDS();
      showToast('Switched to Live Kitchen Display System (KDS)');
    } else {
      state.currentView = 'customer';
      customerView.style.display = 'block';
      kdsView.style.display = 'none';
      if (modeBtn) modeBtn.innerHTML = '<span>👨‍🍳 Switch to Kitchen KDS</span>';
      checkActiveTableOrder();
      showToast('Switched to Customer Table Ordering');
    }
  }

  function openCartDrawer() {
    document.getElementById('cartDrawerOverlay')?.classList.add('active');
    document.getElementById('cartDrawer')?.classList.add('active');
  }

  function closeCartDrawer() {
    document.getElementById('cartDrawerOverlay')?.classList.remove('active');
    document.getElementById('cartDrawer')?.classList.remove('active');
  }

  function closeModal(modalId) {
    document.getElementById(modalId)?.classList.remove('active');
  }

  function showToast(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.innerHTML = `<span>⚡</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // --- GLOBAL EXPORTS FOR INLINE HTML HANDLERS ---
  window.sizzleApp = {
    changeQty: updateItemQuantity,
    removeItem: removeCartItem,
    openCustomizer: openCustomizer,
    closeModal: closeModal,
    advanceOrderStatus: advanceOrderStatus,
    cancelOrder: cancelOrder,
    dismissService: dismissService,
    acceptService: acceptService,
    toggleResolvedServices: toggleResolvedServices,
    changeTable: changeTable,
    openTablePicker: () => document.getElementById('tablePickerModal')?.classList.add('active'),
    openQRModal: openTableQRModal,
    openServiceModal: () => document.getElementById('serviceModal')?.classList.add('active'),
    sendServiceRequest: sendServiceRequest,
    openOrderTracker: openOrderTracker,
    closeTrackerAndShop: () => {
      closeModal('orderTrackerModal');
      window.scrollTo({ top: 400, behavior: 'smooth' });
    }
  };

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
