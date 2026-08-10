import { renderHeader } from '../components/header.js';
import { store } from '../store.js';
import { calcularIdade, formatDate, getStatusColor } from '../utils/helpers.js';
import { renderPedigreeTree } from '../components/pedigreeTree.js';
import { modal } from '../components/modal.js';
import { initPesagemChart } from '../components/charts.js';

export const renderProfile = async (container, id) => {
  let animal = null;
  try {
    animal = await store.getAnimal(id);
  } catch (e) {
    container.innerHTML = '<div class="empty-state">Animal não encontrado</div>';
    return;
  }

  let currentTab = 'informacoes';

  const renderTabs = () => `
    <div class="tabs mb-3 slide-up stagger-2" style="display: flex; gap: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; overflow-x: auto;">
      <button class="btn ${currentTab==='informacoes'?'btn-primary':'btn-outline'}" onclick="window.switchTab('informacoes')">Informações</button>
      <button class="btn ${currentTab==='genealogia'?'btn-primary':'btn-outline'}" onclick="window.switchTab('genealogia')">Genealogia</button>
      <button class="btn ${currentTab==='saude'?'btn-primary':'btn-outline'}" onclick="window.switchTab('saude')">Saúde</button>
      <button class="btn ${currentTab==='reproducao'?'btn-primary':'btn-outline'}" onclick="window.switchTab('reproducao')">Reprodução</button>
      <button class="btn ${currentTab==='anotacoes'?'btn-primary':'btn-outline'}" onclick="window.switchTab('anotacoes')">Anotações</button>
    </div>
    <div id="tab-content" class="slide-up stagger-3"></div>
  `;

  const initials = animal.nome ? animal.nome.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : 'HK';

  container.innerHTML = `
    <div id="header-container"></div>
    
    <!-- Hero Section Clean Redesign -->
    <div class="card slide-up stagger-1 mb-3" style="padding: 16px; border-radius: var(--radius-lg); background: var(--bg-card);">
      <div style="display: flex; gap: 20px; align-items: flex-start; flex-wrap: wrap;">
        <!-- Avatar / Foto -->
        <div style="width: 110px; height: 110px; border-radius: var(--radius-md); overflow: hidden; background: var(--bg-lighter); flex-shrink: 0; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border-color);">
          ${animal.foto_url 
            ? `<img src="${animal.foto_url}" style="width:100%; height:100%; object-fit:cover;">`
            : `<span style="font-family: var(--font-heading); font-size: 2rem; font-weight: 700; color: var(--accent-gold);">${initials}</span>`
          }
        </div>
        
        <!-- Info Principal -->
        <div style="flex: 1; min-width: 240px;">
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 6px;">
            <h2 style="margin: 0; font-size: 1.3rem; color: var(--text-primary);">${animal.nome}</h2>
            ${animal.status_reprodutivo ? `<span class="badge" style="background: ${getStatusColor(animal.status_reprodutivo)}; color: #fff; font-size: 0.65rem;">${animal.status_reprodutivo}</span>` : ''}
          </div>

          <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 12px; display: flex; flex-wrap: wrap; gap: 12px;">
            <span><strong>Pelagem:</strong> ${animal.pelagem || '--'}</span>
            <span><strong>Marcha:</strong> ${animal.tipo_marcha || 'Mangalarga Marchador'}</span>
            <span><strong>Idade:</strong> ${animal.data_nascimento ? calcularIdade(animal.data_nascimento) : '--'}</span>
            ${animal.registro_abccmm ? `<span><strong>ABCCMM:</strong> ${animal.registro_abccmm}</span>` : ''}
          </div>

          <!-- Metricas Fisicas & Local -->
          <div style="display: flex; gap: 16px; font-size: 0.8rem; color: var(--text-muted); flex-wrap: wrap; background: var(--bg-lighter); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <div><i data-lucide="scale" style="width: 14px; height: 14px; vertical-align: middle;"></i> <strong>Peso:</strong> ${animal.peso ? animal.peso + ' kg' : '--'}</div>
            <div><i data-lucide="ruler" style="width: 14px; height: 14px; vertical-align: middle;"></i> <strong>Altura:</strong> ${animal.altura ? animal.altura + ' m' : '--'}</div>
            <div><i data-lucide="map-pin" style="width: 14px; height: 14px; vertical-align: middle;"></i> <strong>Local:</strong> ${animal.baia_piquete || '--'}</div>
            <div><i data-lucide="heart" style="width: 14px; height: 14px; vertical-align: middle;"></i> <strong>Saúde:</strong> ${animal.status_saude || '--'}</div>
          </div>
        </div>

        <!-- Ações -->
        <div style="display: flex; gap: 8px; flex-shrink: 0;">
          <a href="#/editar-animal/${id}" class="btn btn-outline" style="font-size: 0.8rem; padding: 6px 12px;"><i data-lucide="edit"></i> Editar</a>
          <button id="btn-delete" class="btn btn-outline" style="color: var(--accent-red); border-color: var(--accent-red); font-size: 0.8rem; padding: 6px 12px;"><i data-lucide="trash"></i> Deletar</button>
        </div>
      </div>
    </div>

    <div id="tabs-container">
      ${renderTabs()}
    </div>
  `;

  renderHeader(container.querySelector('#header-container'), 'Perfil do Animal');
  if (window.lucide) window.lucide.createIcons();

  // Handle Delete
  document.getElementById('btn-delete').addEventListener('click', () => {
    if (confirm('Tem certeza que deseja deletar este animal?')) {
      store.deleteAnimal(id).then(() => {
        window.location.hash = '#/catalogo';
      });
    }
  });

  // Tab switching logic
  window.switchTab = async (tab) => {
    currentTab = tab;
    document.getElementById('tabs-container').innerHTML = renderTabs();
    const content = document.getElementById('tab-content');
    content.innerHTML = '<div class="skeleton" style="height: 300px;"></div>';
    
    if (tab === 'informacoes') {
      let pesagens = [];
      try { pesagens = await store.getPesagens(id); } catch(e){}
      
      content.innerHTML = `
        <div class="grid-2">
          <div class="card">
            <h3 style="margin-bottom: 15px;">Detalhes</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
              <div><strong style="color: var(--text-muted); font-size: 0.9em;">Nome</strong><div>${animal.nome}</div></div>
              <div><strong style="color: var(--text-muted); font-size: 0.9em;">Apelido</strong><div>${animal.apelido || '--'}</div></div>
              <div><strong style="color: var(--text-muted); font-size: 0.9em;">Registro ABCCMM</strong><div>${animal.registro_abccmm || '--'}</div></div>
              <div><strong style="color: var(--text-muted); font-size: 0.9em;">Registro Interno</strong><div>${animal.registro || '--'}</div></div>
              <div><strong style="color: var(--text-muted); font-size: 0.9em;">Data Nasc.</strong><div>${animal.data_nascimento ? formatDate(animal.data_nascimento) : '--'}</div></div>
              <div><strong style="color: var(--text-muted); font-size: 0.9em;">Sexo</strong><div>${animal.sexo === 'Fêmea' ? 'Égua' : 'Garanhão'}</div></div>
              <div><strong style="color: var(--text-muted); font-size: 0.9em;">Pelagem</strong><div>${animal.pelagem}</div></div>
              <div><strong style="color: var(--text-muted); font-size: 0.9em;">Tipo de Marcha</strong><div>${animal.tipo_marcha || '--'}</div></div>
              <div><strong style="color: var(--text-muted); font-size: 0.9em;">Premiações</strong><div>${animal.premiacao || '--'}</div></div>
              <div><strong style="color: var(--text-muted); font-size: 0.9em;">Observações</strong><div style="grid-column: 1/-1;">${animal.observacoes || '--'}</div></div>
            </div>
          </div>
          <div class="card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
              <h3>Histórico de Peso</h3>
              <button class="btn btn-outline" id="btn-add-peso">Registrar</button>
            </div>
            ${pesagens.length > 0 ? `<div style="height: 250px;"><canvas id="chart-peso"></canvas></div>` : '<p class="empty-state">Sem registros de peso.</p>'}
          </div>
        </div>
      `;

      if (pesagens.length > 0) {
        setTimeout(() => {
          initPesagemChart('chart-peso', {
            labels: pesagens.map(p => formatDate(p.data_pesagem)),
            values: pesagens.map(p => p.peso)
          });
        }, 100);
      }

      document.getElementById('btn-add-peso').addEventListener('click', () => {
        modal.open('Registrar Pesagem', `
          <div class="form-group"><label>Data</label><input type="date" id="peso-data" value="${new Date().toISOString().split('T')[0]}" required></div>
          <div class="form-group"><label>Peso (kg)</label><input type="number" step="0.1" id="peso-valor" required></div>
        `, `
          <button class="btn btn-primary" id="save-peso">Salvar</button>
        `);
        document.getElementById('save-peso').addEventListener('click', async () => {
          await store.createPesagem({
            animal_id: id,
            data_pesagem: document.getElementById('peso-data').value,
            peso: parseFloat(document.getElementById('peso-valor').value)
          });
          modal.close();
          window.switchTab('informacoes');
        });
      });

    } else if (tab === 'genealogia') {
      let genealogia = null;
      let animaisMap = {};
      try {
        genealogia = await store.getGenealogia(id);
        animaisMap = await store.getAnimaisMap();
      } catch(e){}

      content.innerHTML = `
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3>Árvore Genealógica (Pedigree)</h3>
            <button class="btn btn-outline" id="btn-edit-genealogia">Editar Genealogia</button>
          </div>
          <div id="tree-container"></div>
        </div>
      `;

      renderPedigreeTree(document.getElementById('tree-container'), genealogia, animaisMap);

      document.getElementById('btn-edit-genealogia').addEventListener('click', async () => {
        const todosAnimais = await store.getAnimais();
        const machos = todosAnimais.filter(a => a.sexo === 'Macho' && a.id !== id);
        const femeas = todosAnimais.filter(a => a.sexo === 'Fêmea' && a.id !== id);
        
        const renderOptions = (list, selectedId) => `
          <option value="">Desconhecido</option>
          ${list.map(a => `<option value="${a.id}" ${a.id === selectedId ? 'selected' : ''}>${a.nome}</option>`).join('')}
        `;

        modal.open('Editar Genealogia', `
          <div class="form-group">
            <label>Pai (Garanhão)</label>
            <select id="gen-pai">${renderOptions(machos, genealogia?.pai_id)}</select>
          </div>
          <div class="form-group">
            <label>Mãe (Égua)</label>
            <select id="gen-mae">${renderOptions(femeas, genealogia?.mae_id)}</select>
          </div>
        `, `
          <button class="btn btn-primary" id="save-genealogia">Salvar</button>
        `);

        document.getElementById('save-genealogia').addEventListener('click', async () => {
          await store.saveGenealogia({
            animal_id: id,
            pai_id: document.getElementById('gen-pai').value || null,
            mae_id: document.getElementById('gen-mae').value || null,
          });
          modal.close();
          window.switchTab('genealogia');
        });
      });

    } else if (tab === 'saude') {
      let registros = [];
      try { registros = await store.getSaudeRegistros(id); } catch(e){}

      content.innerHTML = `
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3>Registros de Saúde e Vacinação</h3>
            <button class="btn btn-primary" id="btn-add-saude">+ Novo Registro</button>
          </div>
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Descrição</th>
                  <th>Profissional</th>
                  <th>Próxima Data</th>
                </tr>
              </thead>
              <tbody>
                ${registros.length === 0 ? '<tr><td colspan="5" class="empty-state">Nenhum registro encontrado.</td></tr>' : 
                  registros.map(r => `
                    <tr>
                      <td>${formatDate(r.data_registro)}</td>
                      <td><span class="badge" style="background: var(--bg-dark);">${r.tipo}</span></td>
                      <td>${r.descricao}</td>
                      <td>${r.veterinario || '--'}</td>
                      <td>${r.proxima_data ? formatDate(r.proxima_data) : '--'}</td>
                    </tr>
                  `).join('')
                }
              </tbody>
            </table>
          </div>
        </div>
      `;

      document.getElementById('btn-add-saude').addEventListener('click', () => {
        modal.open('Novo Registro de Saúde', `
          <div class="form-group"><label>Tipo</label>
            <select id="saude-tipo">
              <option>Vacina</option>
              <option>Vermífugo</option>
              <option>Exame</option>
              <option>Odontologia</option>
              <option>Cirurgia/Tratamento</option>
              <option>Outro</option>
            </select>
          </div>
          <div class="form-group"><label>Data</label><input type="date" id="saude-data" value="${new Date().toISOString().split('T')[0]}"></div>
          <div class="form-group"><label>Descrição / Medicamento</label><input type="text" id="saude-desc" required></div>
          <div class="form-group"><label>Veterinário / Responsável</label><input type="text" id="saude-vet"></div>
          <div class="form-group"><label>Próxima Aplicação/Exame</label><input type="date" id="saude-prox"></div>
        `, `
          <button class="btn btn-primary" id="save-saude">Salvar</button>
        `);

        document.getElementById('save-saude').addEventListener('click', async () => {
          await store.createSaudeRegistro({
            animal_id: id,
            tipo: document.getElementById('saude-tipo').value,
            data_registro: document.getElementById('saude-data').value,
            descricao: document.getElementById('saude-desc').value,
            veterinario: document.getElementById('saude-vet').value,
            proxima_data: document.getElementById('saude-prox').value || null
          });
          modal.close();
          window.switchTab('saude');
        });
      });

    } else if (tab === 'reproducao') {
      let eventos = [];
      try { eventos = await store.getReproducao(id); } catch(e){}

      content.innerHTML = `
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3>Histórico Reprodutivo</h3>
            <button class="btn btn-primary" id="btn-add-reproducao">+ Novo Evento</button>
          </div>
          <div class="table-responsive">
            <table class="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Evento</th>
                  <th>Garanhão / Doadora</th>
                  <th>Previsão Parto</th>
                  <th>Observações</th>
                </tr>
              </thead>
              <tbody>
                ${eventos.length === 0 ? '<tr><td colspan="5" class="empty-state">Nenhum evento reprodutivo.</td></tr>' : 
                  eventos.map(ev => `
                    <tr>
                      <td>${formatDate(ev.data_evento)}</td>
                      <td><span class="badge badge-prenha">${ev.tipo_evento}</span></td>
                      <td>${ev.parceiro_nome || '--'}</td>
                      <td>${ev.previsao_parto ? formatDate(ev.previsao_parto) : '--'}</td>
                      <td>${ev.observacoes || '--'}</td>
                    </tr>
                  `).join('')
                }
              </tbody>
            </table>
          </div>
        </div>
      `;

      document.getElementById('btn-add-reproducao').addEventListener('click', () => {
        modal.open('Novo Evento Reprodutivo', `
          <div class="form-group"><label>Tipo de Evento</label>
            <select id="rep-tipo">
              <option>Inseminação / Cobertura</option>
              <option>Diagnóstico de Gestação (DG+)</option>
              <option>Transferência de Embrião (TE)</option>
              <option>Parto</option>
              <option>Cio</option>
              <option>Absorção / Aborto</option>
            </select>
          </div>
          <div class="form-group"><label>Data</label><input type="date" id="rep-data" value="${new Date().toISOString().split('T')[0]}"></div>
          <div class="form-group"><label>Garanhão / Parceiro(a)</label><input type="text" id="rep-parceiro"></div>
          <div class="form-group"><label>Previsão de Parto</label><input type="date" id="rep-parto"></div>
          <div class="form-group"><label>Observações</label><textarea id="rep-obs"></textarea></div>
        `, `
          <button class="btn btn-primary" id="save-rep">Salvar</button>
        `);

        document.getElementById('save-rep').addEventListener('click', async () => {
          await store.createReproducao({
            animal_id: id,
            tipo_evento: document.getElementById('rep-tipo').value,
            data_evento: document.getElementById('rep-data').value,
            parceiro_nome: document.getElementById('rep-parceiro').value,
            previsao_parto: document.getElementById('rep-parto').value || null,
            observacoes: document.getElementById('rep-obs').value
          });
          modal.close();
          window.switchTab('reproducao');
        });
      });

    } else if (tab === 'anotacoes') {
      let anotacoes = [];
      try { anotacoes = await store.getAnotacoes(id); } catch(e){}

      content.innerHTML = `
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h3>Anotações e Diário</h3>
            <button class="btn btn-primary" id="btn-add-anotacao">+ Nova Anotação</button>
          </div>
          <div style="display: flex; flex-direction: column; gap: 15px;">
            ${anotacoes.length === 0 ? '<p class="empty-state">Nenhuma anotação registrada.</p>' : 
              anotacoes.map(a => `
                <div style="padding: 15px; background: var(--bg-lighter); border-radius: var(--radius-md); border-left: 4px solid var(--accent-gold);">
                  <div style="display: flex; justify-content: space-between; font-size: 0.85em; color: var(--text-muted); margin-bottom: 5px;">
                    <span>${formatDate(a.data_registro)}</span>
                    <span>${a.autor || 'Sistema'}</span>
                  </div>
                  <p style="margin: 0;">${a.texto}</p>
                </div>
              `).join('')
            }
          </div>
        </div>
      `;

      document.getElementById('btn-add-anotacao').addEventListener('click', () => {
        modal.open('Nova Anotação', `
          <div class="form-group"><label>Anotação</label><textarea id="anotacao-texto" rows="4" required></textarea></div>
          <div class="form-group"><label>Autor</label><input type="text" id="anotacao-autor" placeholder="Seu nome"></div>
        `, `
          <button class="btn btn-primary" id="save-anotacao">Salvar</button>
        `);

        document.getElementById('save-anotacao').addEventListener('click', async () => {
          await store.createAnotacao({
            animal_id: id,
            texto: document.getElementById('anotacao-texto').value,
            autor: document.getElementById('anotacao-autor').value || 'Administrador',
            data_registro: new Date().toISOString()
          });
          modal.close();
          window.switchTab('anotacoes');
        });
      });
    }

    if (window.lucide) window.lucide.createIcons();
  };

  // Initial tab load
  window.switchTab('informacoes');
};
