import { renderHeader } from '../components/header.js';
import { store } from '../store.js';
import { modal } from '../components/modal.js';

export const renderSettings = async (container) => {
  container.innerHTML = `
    <div id="header-container"></div>
    
    <div class="card mb-3 slide-up stagger-1">
      <h2>Informações do Haras</h2>
      <form id="settings-form" class="form-grid" style="margin-top: 15px;">
        <div class="form-group">
          <label>Nome do Haras</label>
          <input type="text" id="config-nome" placeholder="Ex: Haras Kneip">
        </div>
        <div class="form-group">
          <label>Proprietário</label>
          <input type="text" id="config-proprietario">
        </div>
        <div class="form-group" style="grid-column: 1 / -1;">
          <label>Localização</label>
          <input type="text" id="config-localizacao">
        </div>
        <div style="grid-column: 1 / -1; display: flex; justify-content: flex-end; margin-top: 10px;">
          <button type="submit" class="btn btn-primary"><i data-lucide="save"></i> Salvar Configurações</button>
        </div>
      </form>
    </div>

    <div class="grid-2 mb-3">
      <div class="card slide-up stagger-2">
        <h2>Gerenciamento de Dados</h2>
        <div style="margin-top: 15px; display: flex; flex-direction: column; gap: 15px;">
          <button id="btn-export-json" class="btn btn-outline" style="width: 100%; justify-content: center;">
            <i data-lucide="download"></i> Exportar Dados (JSON)
          </button>
          
          <div style="position: relative;">
            <input type="file" id="file-import-json" accept=".json" style="position: absolute; width: 100%; height: 100%; opacity: 0; cursor: pointer;">
            <button class="btn btn-outline" style="width: 100%; justify-content: center;">
              <i data-lucide="upload"></i> Importar Dados (JSON)
            </button>
          </div>
        </div>
      </div>
      
      <div class="card slide-up stagger-3">
        <h2>Sobre o Sistema</h2>
        <div style="margin-top: 15px;">
          <p><strong>Haras Kneip Manager</strong></p>
          <p>Versão 1.0.0</p>
          <p style="margin-top: 10px; color: var(--text-muted); font-size: 0.9em;">
            Sistema de gestão de equinos com foco em controle de plantel, sanidade e reprodução.
          </p>
        </div>
      </div>
    </div>
  `;

  renderHeader(container.querySelector('#header-container'), 'Configurações');

  try {
    const configuracoes = await store.getConfiguracoes();
    const configMap = {};
    if (configuracoes) {
      configuracoes.forEach(c => configMap[c.chave] = c.valor);
    }
    
    document.getElementById('config-nome').value = configMap['haras_nome'] || '';
    document.getElementById('config-proprietario').value = configMap['proprietario'] || '';
    document.getElementById('config-localizacao').value = configMap['localizacao'] || '';

  } catch (e) {
    console.error('Error loading config:', e);
  }

  document.getElementById('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await store.saveConfiguracao('haras_nome', document.getElementById('config-nome').value);
      await store.saveConfiguracao('proprietario', document.getElementById('config-proprietario').value);
      await store.saveConfiguracao('localizacao', document.getElementById('config-localizacao').value);
      alert('Configurações salvas com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar configurações.');
    }
  });

  document.getElementById('btn-export-json').addEventListener('click', async () => {
    try {
      const data = await store.exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('hidden', '');
      a.setAttribute('href', url);
      a.setAttribute('download', 'haras_backup.json');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error(e);
      alert('Erro ao exportar dados.');
    }
  });

  if (window.lucide) window.lucide.createIcons();
};
