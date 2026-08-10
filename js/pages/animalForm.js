import { renderHeader } from '../components/header.js';
import { store } from '../store.js';
import { voiceAssistant } from '../components/voiceAssistant.js';

export const renderAnimalForm = async (container, id = null) => {
  const isEditing = !!id;
  let animal = null;

  if (isEditing) {
    try {
      animal = await store.getAnimal(id);
    } catch (e) {
      console.error(e);
      container.innerHTML = '<div class="empty-state">Animal não encontrado.</div>';
      return;
    }
  }

  const title = isEditing ? 'Editar Animal' : 'Novo Animal';
  const pelagens = ['Alazã', 'Baia', 'Castanha', 'Pampa', 'Preta', 'Rosilha', 'Tordilha', 'Tordilha Negra', 'Zaina', 'Outra'];

  container.innerHTML = `
    <div id="header-container"></div>
    <div class="card slide-up stagger-1" style="max-width: 800px; margin: 0 auto; position: relative;">
      
      <!-- Voice Assistant Trigger Button -->
      <div style="background: linear-gradient(135deg, var(--accent-gold) 0%, var(--accent-gold-light) 100%); padding: 12px 16px; border-radius: var(--radius-md); color: #fff; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: var(--shadow-sm);">
        <div>
          <strong style="font-size: 0.95rem; display: block; color: #fff;">🎙️ Assistente de Voz do Haras</strong>
          <span style="font-size: 0.75rem; opacity: 0.9; color: #fff;">Prefere falar em vez de digitar? A IA pergunta e preenche para você!</span>
        </div>
        <button id="btn-voice-fill" type="button" class="btn" style="background: #fff; color: var(--accent-gold-dark); font-weight: 700; font-size: 0.8rem; padding: 6px 14px; border-radius: var(--radius-full);">
          🎙️ Iniciar Conversa por Voz
        </button>
      </div>

      <form id="animal-form" class="form-grid">
        <h3 style="grid-column: 1 / -1; margin-bottom: var(--spacing-md); color: var(--accent-gold);">Identificação</h3>
        
        <div class="form-group">
          <label>Nome Completo *</label>
          <input type="text" id="form-nome" required value="${animal?.nome || ''}" placeholder="Ex: Estrela D'Alva do Kneip">
        </div>
        <div class="form-group">
          <label>Apelido</label>
          <input type="text" id="form-apelido" value="${animal?.apelido || ''}" placeholder="Ex: Estrelinha">
        </div>
        <div class="form-group">
          <label>Nº Registro ABCCMM</label>
          <input type="text" id="form-registro_abccmm" value="${animal?.registro_abccmm || ''}" placeholder="Ex: 001.234-A">
        </div>
        <div class="form-group">
          <label>Registro Interno</label>
          <input type="text" id="form-registro" value="${animal?.registro || ''}" placeholder="Ex: MM-2024-001">
        </div>

        <h3 style="grid-column: 1 / -1; margin: var(--spacing-md) 0; color: var(--accent-gold);">Características</h3>
        
        <div class="form-group">
          <label>Pelagem</label>
          <select id="form-pelagem">
            ${pelagens.map(p => `<option value="${p}" ${animal?.pelagem === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Tipo de Marcha</label>
          <select id="form-tipo_marcha">
            <option value="Marcha Batida" ${animal?.tipo_marcha === 'Marcha Batida' ? 'selected' : ''}>Marcha Batida</option>
            <option value="Marcha Picada" ${animal?.tipo_marcha === 'Marcha Picada' ? 'selected' : ''}>Marcha Picada</option>
          </select>
        </div>
        <div class="form-group">
          <label>Sexo</label>
          <select id="form-sexo">
            <option value="Fêmea" ${animal?.sexo === 'Fêmea' ? 'selected' : ''}>Fêmea (Égua)</option>
            <option value="Macho" ${animal?.sexo === 'Macho' ? 'selected' : ''}>Macho (Garanhão)</option>
          </select>
        </div>

        <h3 style="grid-column: 1 / -1; margin: var(--spacing-md) 0; color: var(--accent-gold);">Dados Físicos</h3>
        
        <div class="form-group">
          <label>Data de Nascimento</label>
          <input type="date" id="form-data_nascimento" value="${animal?.data_nascimento || ''}">
        </div>
        <div class="form-group">
          <label>Peso (kg)</label>
          <input type="number" step="0.1" id="form-peso" value="${animal?.peso || ''}" placeholder="Ex: 450">
        </div>
        <div class="form-group">
          <label>Altura (m)</label>
          <input type="number" step="0.01" id="form-altura" value="${animal?.altura || ''}" placeholder="Ex: 1.52">
        </div>

        <h3 style="grid-column: 1 / -1; margin: var(--spacing-md) 0; color: var(--accent-gold);">Localização e Status</h3>
        
        <div class="form-group">
          <label>Baia / Piquete</label>
          <input type="text" id="form-baia" value="${animal?.baia_piquete || ''}" placeholder="Ex: Piquete 3">
        </div>
        <div class="form-group">
          <label>Status Reprodutivo</label>
          <select id="form-status_reprodutivo">
            ${['Vazia', 'Prenha', 'Lactante', 'Em Cobertura', 'Potro/Potra', 'Garanhão Ativo'].map(s => `<option value="${s}" ${animal?.status_reprodutivo === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Status Saúde</label>
          <input type="text" id="form-status_saude" value="${animal?.status_saude || 'Saudável'}">
        </div>
        <div class="form-group">
          <label>Premiações</label>
          <input type="text" id="form-premiacao" value="${animal?.premiacao || ''}" placeholder="Ex: Campeã Nacional 2023">
        </div>

        <h3 style="grid-column: 1 / -1; margin: var(--spacing-md) 0; color: var(--accent-gold);">Foto do Animal</h3>
        
        <!-- File Upload Section (Camera/Gallery) -->
        <div class="form-group" style="grid-column: 1 / -1;">
          <label>Anexar Foto (Câmera ou Galeria)</label>
          <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
            <input type="file" id="form-foto-file" accept="image/*" style="display: none;">
            <input type="hidden" id="form-foto_url" value="${animal?.foto_url || ''}">
            
            <button type="button" id="btn-trigger-upload" class="btn btn-secondary" style="display: flex; align-items: center; gap: 6px;">
              📸 Tirar Foto / Escolher Arquivo
            </button>
            
            <div id="foto-preview-container" style="width: 70px; height: 70px; border-radius: var(--radius-md); overflow: hidden; background: var(--bg-lighter); border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: center;">
              ${animal?.foto_url ? `<img src="${animal.foto_url}" style="width:100%; height:100%; object-fit:cover;" id="img-preview">` : '<span style="font-size:0.7rem; color:var(--text-muted); text-align:center;">Sem Foto</span>'}
            </div>
            <span id="upload-status-text" style="font-size: 0.75rem; color: var(--text-muted);"></span>
          </div>
        </div>

        <div class="form-group" style="grid-column: 1 / -1;">
          <label>Observações</label>
          <textarea id="form-observacoes" rows="3">${animal?.observacoes || ''}</textarea>
        </div>

        <div style="grid-column: 1 / -1; display: flex; gap: var(--spacing-md); justify-content: flex-end; margin-top: var(--spacing-lg);">
          <button type="button" class="btn btn-outline" onclick="window.history.back()">Cancelar</button>
          <button type="submit" class="btn btn-primary">Salvar Animal</button>
        </div>
      </form>
    </div>
  `;

  renderHeader(container.querySelector('#header-container'), title);
  if (window.lucide) window.lucide.createIcons();

  // Handle Photo File Upload
  const fileInput = document.getElementById('form-foto-file');
  const triggerBtn = document.getElementById('btn-trigger-upload');
  const previewContainer = document.getElementById('foto-preview-container');
  const hiddenUrlInput = document.getElementById('form-foto_url');
  const statusText = document.getElementById('upload-status-text');

  triggerBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    statusText.textContent = 'Processando imagem...';

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      hiddenUrlInput.value = dataUrl;
      previewContainer.innerHTML = `<img src="${dataUrl}" style="width:100%; height:100%; object-fit:cover;">`;
      statusText.textContent = '✅ Foto anexada com sucesso!';
    };
    reader.readAsDataURL(file);
  });

  // Handle Voice Assistant Trigger
  document.getElementById('btn-voice-fill').addEventListener('click', () => {
    voiceAssistant.startWizard((voiceData) => {
      // Pre-fill form fields automatically with voice data
      if (voiceData.nome) document.getElementById('form-nome').value = voiceData.nome;
      if (voiceData.apelido) document.getElementById('form-apelido').value = voiceData.apelido;
      if (voiceData.registro_abccmm) document.getElementById('form-registro_abccmm').value = voiceData.registro_abccmm;
      if (voiceData.pelagem) document.getElementById('form-pelagem').value = voiceData.pelagem;
      if (voiceData.tipo_marcha) document.getElementById('form-tipo_marcha').value = voiceData.tipo_marcha;
      if (voiceData.sexo) document.getElementById('form-sexo').value = voiceData.sexo;
      if (voiceData.data_nascimento) document.getElementById('form-data_nascimento').value = voiceData.data_nascimento;
      if (voiceData.peso) document.getElementById('form-peso').value = voiceData.peso;
      if (voiceData.altura) document.getElementById('form-altura').value = voiceData.altura;
      if (voiceData.baia_piquete) document.getElementById('form-baia').value = voiceData.baia_piquete;
      if (voiceData.status_reprodutivo) document.getElementById('form-status_reprodutivo').value = voiceData.status_reprodutivo;
      if (voiceData.status_saude) document.getElementById('form-status_saude').value = voiceData.status_saude;
      if (voiceData.premiacao) document.getElementById('form-premiacao').value = voiceData.premiacao;

      document.getElementById('animal-form').scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Handle Form Submit
  document.getElementById('animal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const data = {
      nome: document.getElementById('form-nome').value,
      apelido: document.getElementById('form-apelido').value,
      registro: document.getElementById('form-registro').value,
      registro_abccmm: document.getElementById('form-registro_abccmm').value,
      raca: 'Mangalarga Marchador',
      pelagem: document.getElementById('form-pelagem').value,
      tipo_marcha: document.getElementById('form-tipo_marcha').value,
      sexo: document.getElementById('form-sexo').value,
      data_nascimento: document.getElementById('form-data_nascimento').value || null,
      peso: parseFloat(document.getElementById('form-peso').value) || null,
      altura: parseFloat(document.getElementById('form-altura').value) || null,
      baia_piquete: document.getElementById('form-baia').value,
      status_reprodutivo: document.getElementById('form-status_reprodutivo').value,
      status_saude: document.getElementById('form-status_saude').value,
      premiacao: document.getElementById('form-premiacao').value,
      foto_url: document.getElementById('form-foto_url').value,
      observacoes: document.getElementById('form-observacoes').value,
    };

    try {
      if (isEditing) {
        await store.updateAnimal(id, data);
        window.location.hash = `#/animal/${id}`;
      } else {
        const newAnimal = await store.createAnimal(data);
        window.location.hash = `#/animal/${newAnimal.id}`;
      }
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar animal: ' + err.message);
    }
  });
};
