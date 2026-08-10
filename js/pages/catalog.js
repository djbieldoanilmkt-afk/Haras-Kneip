import { renderHeader } from '../components/header.js';
import { renderAnimalCard } from '../components/animalCard.js';
import { store } from '../store.js';

export const renderCatalog = async (container) => {
  container.innerHTML = `
    <div id="header-container"></div>
    
    <!-- Plantel Share Banner -->
    <div style="background: var(--bg-card); border: 1px solid var(--border-color); padding: 10px 14px; border-radius: var(--radius-md); margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;" class="slide-up">
      <div>
        <strong style="font-size: 0.85rem; color: var(--accent-gold);">🔗 Link de Apresentação do Plantel</strong>
        <span style="font-size: 0.75rem; color: var(--text-muted); display: block;">Compartilhe os animais selecionados com outros criadores no WhatsApp.</span>
      </div>
      <div style="display: flex; gap: 6px; flex-wrap: wrap;">
        <button id="btn-select-all" class="btn btn-secondary" style="font-size: 0.75rem; padding: 4px 10px;">
          ✅ Incluir Todos
        </button>
        <button id="btn-deselect-all" class="btn btn-secondary" style="font-size: 0.75rem; padding: 4px 10px; color: var(--accent-red); border-color: var(--accent-red);">
          🚫 Remover Todos
        </button>
        <button id="btn-copy-link" class="btn btn-secondary" style="font-size: 0.75rem; padding: 4px 10px;">
          📋 Copiar Link
        </button>
        <button id="btn-share-wsp" class="btn" style="background: #25D366; color: #fff; font-size: 0.75rem; padding: 4px 10px; font-weight: 600;">
          💬 Enviar no WhatsApp
        </button>
      </div>
    </div>

    <!-- Filters Bar -->
    <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 12px;" class="slide-up">
      <div style="display: flex; gap: 4px; flex-wrap: wrap;">
        <button class="filter-btn btn btn-primary" data-filter="all" aria-pressed="true" style="font-size:0.7rem; padding: 4px 10px;">Todos</button>
        <button class="filter-btn btn btn-secondary" data-filter="Fêmea" aria-pressed="false" style="font-size:0.7rem; padding: 4px 10px;">Éguas</button>
        <button class="filter-btn btn btn-secondary" data-filter="Macho" aria-pressed="false" style="font-size:0.7rem; padding: 4px 10px;">Garanhões</button>
        <button class="filter-btn btn btn-secondary" data-filter="Prenha" aria-pressed="false" style="font-size:0.7rem; padding: 4px 10px;">Prenhas</button>
        <button class="filter-btn btn btn-secondary" data-filter="destaque" aria-pressed="false" style="font-size:0.7rem; padding: 4px 10px; border-color: var(--accent-gold); color: var(--accent-gold);">⭐ No Link</button>
      </div>
      <div style="display: flex; gap: 6px; align-items: center;">
        <span style="font-size: 0.75rem; color: var(--text-muted);">
          Total: <strong id="catalog-count" style="color: var(--text-primary); transition: opacity 0.3s;">0</strong>
        </span>
        <select class="select" style="width: auto; font-size: 0.75rem; padding: 4px 8px;">
          <option>Nome</option>
          <option>Idade</option>
        </select>
        <div style="display: flex; gap: 2px; background: var(--bg-lighter); padding: 2px; border-radius: var(--radius-sm);">
          <button id="view-grid" class="btn btn-ghost" style="padding: 3px; background: var(--bg-card);"><i data-lucide="layout-grid"></i></button>
          <button id="view-list" class="btn btn-ghost" style="padding: 3px;"><i data-lucide="list"></i></button>
        </div>
      </div>
    </div>
    
    <div id="catalog-results" aria-live="polite">
      <div id="catalog-grid" class="grid-4" style="transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);">
        <div class="skeleton" style="height: 200px; border-radius: var(--radius-lg);"></div>
        <div class="skeleton" style="height: 200px; border-radius: var(--radius-lg);"></div>
        <div class="skeleton" style="height: 200px; border-radius: var(--radius-lg);"></div>
        <div class="skeleton" style="height: 200px; border-radius: var(--radius-lg);"></div>
      </div>
    </div>
  `;
  
  renderHeader(container.querySelector('#header-container'), 'Catálogo');
  if (window.lucide) window.lucide.createIcons();

  let todosAnimais = [];
  let genealogiaMap = {};
  let activeFilters = new Set();
  
  const updateGrid = (animais) => {
    const grid = container.querySelector('#catalog-grid');
    const countEl = container.querySelector('#catalog-count');
    
    countEl.style.opacity = '0';
    setTimeout(() => {
      countEl.textContent = animais.length;
      countEl.style.opacity = '1';
    }, 150);

    if (animais && animais.length > 0) {
      grid.innerHTML = animais.map((a, i) => {
        const gen = genealogiaMap[a.id] || null;
        const cardHtml = renderAnimalCard(a, gen);

        const isSelected = a.em_destaque !== false;
        const toggleBtnHtml = `
          <div style="padding: 4px 10px 8px; border-top: 1px dashed var(--border-color); display: flex; justify-content: space-between; align-items: center; background: var(--bg-card);">
            <span style="font-size: 0.65rem; color: var(--text-muted);">Exibir no Link:</span>
            <button class="btn btn-toggle-showcase ${isSelected ? 'btn-primary' : 'btn-secondary'}" data-id="${a.id}" data-active="${isSelected}" style="font-size: 0.6rem; padding: 2px 8px; border-radius: 10px;">
              ${isSelected ? '⭐ Incluído' : '➕ Incluir'}
            </button>
          </div>
        `;

        const finalCard = cardHtml.replace('</article>', `${toggleBtnHtml}</article>`);
        return finalCard.replace('scale-in', `scale-in stagger-${(i % 10) + 1}`);
      }).join('');
    } else {
      grid.innerHTML = `
        <div class="empty-state slide-up" style="grid-column: 1 / -1; padding: 40px; text-align: center;">
          <div style="font-size: 4rem; margin-bottom: 16px; animation: bounce 2s infinite;">🐴</div>
          <h3>Nenhum cavalo encontrado</h3>
          <p style="color: var(--text-muted); max-width: 300px; margin: 0 auto;">Tente ajustar os filtros ou pesquisar por outro nome.</p>
        </div>
      `;
    }
    
    if (window.lucide) window.lucide.createIcons();
    
    // Showcase toggle click listeners
    grid.querySelectorAll('.btn-toggle-showcase').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const current = btn.getAttribute('data-active') === 'true';
        const updated = !current;
        
        btn.setAttribute('data-active', updated);
        btn.className = `btn btn-toggle-showcase ${updated ? 'btn-primary' : 'btn-secondary'}`;
        btn.innerHTML = updated ? '⭐ Incluído' : '➕ Incluir';

        const targetAnimal = todosAnimais.find(a => a.id === id);
        if (targetAnimal) targetAnimal.em_destaque = updated;

        try {
          await store.toggleDestaque(id, updated);
          if (window.showToast) window.showToast(updated ? 'Animal adicionado ao link!' : 'Animal removido do link.', 'info');
        } catch (err) {
          console.error(err);
        }
      });
    });
  };

  const applyFilters = () => {
    if (activeFilters.size === 0) {
      updateGrid(todosAnimais);
      return;
    }
    
    const filtrados = todosAnimais.filter(a => {
      let matches = false;
      if (activeFilters.has('Fêmea') && a.sexo === 'Fêmea') matches = true;
      if (activeFilters.has('Macho') && a.sexo === 'Macho') matches = true;
      if (activeFilters.has('Prenha') && a.status_reprodutivo === 'Prenha') matches = true;
      if (activeFilters.has('destaque') && a.em_destaque !== false) matches = true;
      return matches;
    });
    
    updateGrid(filtrados);
  };

  try {
    const [animais, genealogias] = await Promise.all([
      store.getAnimais(),
      store.getAllGenealogias()
    ]);
    todosAnimais = animais;

    const nomeMap = {};
    animais.forEach(a => { nomeMap[a.id] = a.nome; });

    genealogias.forEach(g => {
      genealogiaMap[g.animal_id] = {
        pai_nome: g.pai_id ? (nomeMap[g.pai_id] || null) : null,
        mae_nome: g.mae_id ? (nomeMap[g.mae_id] || null) : null
      };
    });

    updateGrid(todosAnimais);
  } catch (e) {
    console.error(e);
    container.querySelector('#catalog-grid').innerHTML = '<p style="color:var(--accent-red);">Erro ao carregar catálogo.</p>';
  }

  // Handle Bulk Inclusion / Removal
  document.getElementById('btn-select-all').addEventListener('click', async () => {
    todosAnimais.forEach(a => a.em_destaque = true);
    updateGrid(todosAnimais);
    try {
      await store.toggleAllDestaque(true);
      if (window.showToast) window.showToast('Todos os animais foram incluídos no link!', 'success');
    } catch (e) { console.error(e); }
  });

  document.getElementById('btn-deselect-all').addEventListener('click', async () => {
    todosAnimais.forEach(a => a.em_destaque = false);
    updateGrid(todosAnimais);
    try {
      await store.toggleAllDestaque(false);
      if (window.showToast) window.showToast('Todos os animais foram removidos do link!', 'info');
    } catch (e) { console.error(e); }
  });

  // Handle Share / Copy Buttons
  const publicUrl = `${window.location.origin}${window.location.pathname}#/plantel`;

  document.getElementById('btn-copy-link').addEventListener('click', () => {
    navigator.clipboard.writeText(publicUrl);
    if (window.showToast) window.showToast('Link de apresentação copiado!', 'success');
  });

  document.getElementById('btn-share-wsp').addEventListener('click', () => {
    const msg = encodeURIComponent(`Olá! Confira a seleção de equinos Mangalarga Marchador do Haras Kneip:\n${publicUrl}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  });

  // Filter Buttons Logic
  const filterBtns = container.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-filter');
      
      if (filter === 'all') {
        activeFilters.clear();
        filterBtns.forEach(b => {
          b.classList.replace('btn-primary', 'btn-secondary');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.replace('btn-secondary', 'btn-primary');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        const allBtn = container.querySelector('[data-filter="all"]');
        allBtn.classList.replace('btn-primary', 'btn-secondary');
        allBtn.setAttribute('aria-pressed', 'false');
        
        if (activeFilters.has(filter)) {
          activeFilters.delete(filter);
          btn.classList.replace('btn-primary', 'btn-secondary');
          btn.setAttribute('aria-pressed', 'false');
        } else {
          activeFilters.add(filter);
          btn.classList.replace('btn-secondary', 'btn-primary');
          btn.setAttribute('aria-pressed', 'true');
        }
        
        if (activeFilters.size === 0) {
          allBtn.classList.replace('btn-secondary', 'btn-primary');
          allBtn.setAttribute('aria-pressed', 'true');
        }
      }
      applyFilters();
    });
  });

  // Global search listener
  const searchHandler = (e) => {
    const term = e.detail.term;
    const filtrados = todosAnimais.filter(a => a.nome.toLowerCase().includes(term) || a.raca.toLowerCase().includes(term));
    updateGrid(filtrados);
  };
  document.addEventListener('globalSearch', searchHandler);

  // View Toggle
  const gridBtn = container.querySelector('#view-grid');
  const listBtn = container.querySelector('#view-list');
  const grid = container.querySelector('#catalog-grid');
  
  gridBtn.addEventListener('click', () => {
    grid.className = 'grid-4';
    gridBtn.style.background = 'var(--bg-card)';
    listBtn.style.background = 'transparent';
  });
  
  listBtn.addEventListener('click', () => {
    grid.className = 'grid-1';
    listBtn.style.background = 'var(--bg-card)';
    gridBtn.style.background = 'transparent';
    grid.style.display = 'flex';
    grid.style.flexDirection = 'column';
  });
};
