import { renderHeader } from '../components/header.js';
import { store } from '../store.js';
import { initPelagemChart, initStatusChart } from '../components/charts.js';
import { formatDate } from '../utils/helpers.js';

// Animated counter utility
const animateValue = (obj, start, end, duration) => {
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    obj.innerHTML = Math.floor(progress * (end - start) + start);
    if (progress < 1) {
      window.requestAnimationFrame(step);
    }
  };
  window.requestAnimationFrame(step);
};

export const renderDashboard = async (container) => {
  container.innerHTML = `
    <div id="header-container"></div>
    
    <div class="grid-4 mb-3" id="dashboard-stats">
      <div class="skeleton" style="height: 100px;"></div>
      <div class="skeleton" style="height: 100px;"></div>
      <div class="skeleton" style="height: 100px;"></div>
      <div class="skeleton" style="height: 100px;"></div>
    </div>
    
    <div class="grid-2 mb-3">
      <div class="card slide-up stagger-5">
        <h3>Distribuição de Pelagens</h3>
        <div style="height: 300px;"><canvas id="chart-pelagem"></canvas></div>
      </div>
      <div class="card slide-up stagger-5">
        <h3>Status Reprodutivo</h3>
        <div style="height: 300px;"><canvas id="chart-status"></canvas></div>
      </div>
    </div>

    <div class="grid-2 mb-3">
      <div class="card slide-up stagger-6">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="display: flex; align-items: center; gap: 8px;">
            <i data-lucide="alert-circle" style="color: var(--accent-red);"></i> Eventos Próximos
          </h3>
          <a href="#/calendario" class="btn btn-ghost" style="font-size: 0.875rem;">Ver Todos</a>
        </div>
        <div id="dashboard-events" class="event-list" style="margin-top: 15px;">
          <div class="skeleton" style="height: 50px;"></div>
        </div>
      </div>
      <div class="card slide-up stagger-6">
        <h3 style="display: flex; align-items: center; gap: 8px;">
          <i data-lucide="clock"></i> Últimos Cadastros
        </h3>
        <div id="dashboard-recent" class="recent-list" style="margin-top: 15px;">
          <div class="skeleton" style="height: 50px;"></div>
        </div>
      </div>
    </div>
  `;
  
  renderHeader(container.querySelector('#header-container'), 'Dashboard');
  
  try {
    const stats = await store.getStats();
    const animais = await store.getAnimais({ orderBy: 'created_at', ascending: false });
    
    // Stats row
    document.getElementById('dashboard-stats').innerHTML = `
      <div class="card stat-card slide-up stagger-1">
        <div class="value stat-counter" data-target="${stats.totalAnimais || 0}" id="stat-total">0</div>
        <div class="label">Total de Animais</div>
      </div>
      <div class="card stat-card slide-up stagger-2">
        <div class="value stat-counter" data-target="${stats.prenhas || 0}" style="color: var(--status-prenha);">0</div>
        <div class="label">Matrizes Prenhas</div>
      </div>
      <div class="card stat-card slide-up stagger-3">
        <div class="value stat-counter" data-target="${stats.lactantes || 0}" style="color: var(--accent-green);">0</div>
        <div class="label">Matrizes Lactantes</div>
      </div>
      <div class="card stat-card slide-up stagger-4">
        <div class="value stat-counter" data-target="${stats.eventosProximos.length || 0}" style="color: var(--accent-blue);">0</div>
        <div class="label">Eventos Próximos (7 dias)</div>
      </div>
    `;

    // Trigger animations for stats
    setTimeout(() => {
      document.querySelectorAll('.stat-counter').forEach(el => {
        const target = parseInt(el.getAttribute('data-target'), 10);
        animateValue(el, 0, target, 1500);
      });
    }, 100);

    // Events list
    const eventsContainer = document.getElementById('dashboard-events');
    if (stats.eventosProximos.length === 0) {
      eventsContainer.innerHTML = '<div class="empty-state" style="padding: 10px;">Nenhum evento próximo.</div>';
    } else {
      eventsContainer.innerHTML = stats.eventosProximos.slice(0, 5).map((e, index) => {
        // Color code based on urgency
        const eventDate = new Date(e.data_evento);
        const today = new Date();
        const diffDays = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));
        let urgencyColor = 'var(--text-primary)';
        if (diffDays <= 2) urgencyColor = 'var(--accent-red)';
        else if (diffDays <= 5) urgencyColor = 'var(--accent-gold)';

        return `
        <div class="slide-up stagger-${(index % 5) + 1}" style="padding: 12px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s;" onclick="window.location.hash='#/animal/${e.animal_id}'" onmouseover="this.style.background='var(--bg-card-hover)'" onmouseout="this.style.background='transparent'">
          <div>
            <strong style="color: ${urgencyColor}">${e.titulo}</strong> 
            <div style="color: var(--text-muted); font-size: 0.85em; display: flex; align-items: center; gap: 4px;"><i data-lucide="tag" style="width: 12px; height: 12px;"></i> ${e.tipo}</div>
          </div>
          <div style="color: var(--accent-gold); font-size: 0.9em; text-align: right;">
            ${formatDate(e.data_evento)}
            <div style="font-size: 0.75rem; color: var(--text-muted);">Em ${diffDays} dias</div>
          </div>
        </div>
      `}).join('');
    }

    // Recent animals
    const recentContainer = document.getElementById('dashboard-recent');
    if (animais.length === 0) {
      recentContainer.innerHTML = '<div class="empty-state" style="padding: 10px;">Nenhum animal cadastrado.</div>';
    } else {
      recentContainer.innerHTML = animais.slice(0, 5).map((a, index) => `
        <div class="slide-up stagger-${(index % 5) + 1}" style="padding: 12px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s;" onclick="window.location.hash='#/animal/${a.id}'" onmouseover="this.style.background='var(--bg-card-hover)'" onmouseout="this.style.background='transparent'">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--bg-dark); overflow: hidden; border: 2px solid var(--accent-gold);">
              ${a.foto_url ? `<img src="${a.foto_url}" style="width:100%; height:100%; object-fit:cover;">` : '<div class="flex items-center justify-center" style="width:100%; height:100%; font-size: 20px;">🐴</div>'}
            </div>
            <div>
              <strong>${a.nome}</strong>
              <div style="color: var(--text-muted); font-size: 0.85em;">${a.raca}</div>
            </div>
          </div>
          <div>
            <i data-lucide="chevron-right" style="color: var(--text-muted);"></i>
          </div>
        </div>
      `).join('');
    }

    // Charts
    setTimeout(() => {
      // Aggregate pelagem
      const pelagens = {};
      const statuses = {};
      animais.forEach(a => {
        pelagens[a.pelagem] = (pelagens[a.pelagem] || 0) + 1;
        if(a.status_reprodutivo) {
          statuses[a.status_reprodutivo] = (statuses[a.status_reprodutivo] || 0) + 1;
        }
      });

      if(Object.keys(pelagens).length > 0) {
        initPelagemChart('chart-pelagem', {
          labels: Object.keys(pelagens),
          values: Object.values(pelagens)
        });
      }
      if(Object.keys(statuses).length > 0) {
        initStatusChart('chart-status', {
          labels: Object.keys(statuses),
          values: Object.values(statuses)
        });
      }
    }, 100);

  } catch (e) {
    console.error(e);
  }

  if (window.lucide) window.lucide.createIcons();
};
