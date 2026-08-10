import { renderHeader } from '../components/header.js';
import { store } from '../store.js';
import { initPelagemChart, initStatusChart, initIdadeChart } from '../components/charts.js';
import { calcularIdade } from '../utils/helpers.js';

export const renderReports = async (container) => {
  container.innerHTML = `
    <div id="header-container"></div>
    
    <div class="card mb-3" style="display: flex; justify-content: space-between; align-items: center;">
      <h2>Relatórios Gerais</h2>
      <button id="btn-export-csv" class="btn btn-primary"><i data-lucide="download"></i> Exportar CSV</button>
    </div>

    <div class="grid-4 mb-3" id="reports-stats">
      <div class="skeleton" style="height: 100px;"></div>
      <div class="skeleton" style="height: 100px;"></div>
      <div class="skeleton" style="height: 100px;"></div>
      <div class="skeleton" style="height: 100px;"></div>
    </div>
    
    <div class="grid-2 mb-3">
      <div class="card">
        <h3>Distribuição de Pelagens</h3>
        <div style="height: 300px;"><canvas id="rep-chart-pelagem"></canvas></div>
      </div>
      <div class="card">
        <h3>Status Reprodutivo</h3>
        <div style="height: 300px;"><canvas id="rep-chart-status"></canvas></div>
      </div>
      <div class="card" style="grid-column: 1 / -1;">
        <h3>Distribuição por Idade</h3>
        <div style="height: 300px;"><canvas id="rep-chart-idade"></canvas></div>
      </div>
    </div>
  `;

  renderHeader(container.querySelector('#header-container'), 'Relatórios');

  try {
    const animais = await store.getAnimais();
    const stats = await store.getStats();

    let somaIdades = 0;
    let animaisComIdade = 0;
    
    const idadesDistrib = { '0-1': 0, '1-3': 0, '3-5': 0, '5-10': 0, '10+': 0 };
    const pelagens = {};
    const statuses = {};

    animais.forEach(a => {
      // Idade logic
      if (a.data_nascimento) {
        const nasc = new Date(a.data_nascimento);
        const agora = new Date();
        let anos = agora.getFullYear() - nasc.getFullYear();
        if (agora.getMonth() < nasc.getMonth() || (agora.getMonth() === nasc.getMonth() && agora.getDate() < nasc.getDate())) {
          anos--;
        }
        
        somaIdades += anos;
        animaisComIdade++;

        if (anos <= 1) idadesDistrib['0-1']++;
        else if (anos <= 3) idadesDistrib['1-3']++;
        else if (anos <= 5) idadesDistrib['3-5']++;
        else if (anos <= 10) idadesDistrib['5-10']++;
        else idadesDistrib['10+']++;
      }

      pelagens[a.pelagem] = (pelagens[a.pelagem] || 0) + 1;
      statuses[a.status_reprodutivo] = (statuses[a.status_reprodutivo] || 0) + 1;
    });

    const idadeMedia = animaisComIdade > 0 ? (somaIdades / animaisComIdade).toFixed(1) : 0;

    document.getElementById('reports-stats').innerHTML = `
      <div class="card stat-card">
        <div class="value">${stats.totalAnimais}</div>
        <div class="label">Total Animais</div>
      </div>
      <div class="card stat-card">
        <div class="value" style="color: var(--accent-gold);">${stats.femeas}</div>
        <div class="label">Fêmeas</div>
      </div>
      <div class="card stat-card">
        <div class="value" style="color: var(--accent-blue);">${stats.machos}</div>
        <div class="label">Machos</div>
      </div>
      <div class="card stat-card">
        <div class="value" style="color: var(--accent-green);">${idadeMedia}</div>
        <div class="label">Idade Média (anos)</div>
      </div>
    `;

    setTimeout(() => {
      initPelagemChart('rep-chart-pelagem', { labels: Object.keys(pelagens), values: Object.values(pelagens) });
      initStatusChart('rep-chart-status', { labels: Object.keys(statuses), values: Object.values(statuses) });
      initIdadeChart('rep-chart-idade', { labels: Object.keys(idadesDistrib), values: Object.values(idadesDistrib) });
    }, 100);

    // CSV Export
    document.getElementById('btn-export-csv').addEventListener('click', () => {
      if (!animais || !animais.length) return;
      const cols = ['id', 'nome', 'registro', 'raca', 'pelagem', 'sexo', 'data_nascimento', 'peso', 'altura', 'baia_piquete', 'status_reprodutivo', 'status_saude'];
      let csv = cols.join(',') + '\n';
      animais.forEach(a => {
        csv += cols.map(c => `"${(a[c] || '').toString().replace(/"/g, '""')}"`).join(',') + '\n';
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('hidden', '');
      a.setAttribute('href', url);
      a.setAttribute('download', 'haras_animais.csv');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });

  } catch (e) {
    console.error(e);
  }

  if (window.lucide) window.lucide.createIcons();
};
