export const renderPedigreeTree = (genealogia, animaisMap = {}) => {
  if (!genealogia) return '<div class="empty-state">Sem dados de genealogia</div>';
  
  const getAnimalInfo = (id) => {
    if (!id) return { nome: 'Desconhecido', id: null };
    const animal = animaisMap[id];
    return animal ? { nome: animal.nome, id: id } : { nome: id, id: null };
  };

  const pai = getAnimalInfo(genealogia.pai_id);
  const mae = getAnimalInfo(genealogia.mae_id);
  const avoPat = getAnimalInfo(genealogia.avo_paterno_id);
  const avoPatMae = getAnimalInfo(genealogia.avo_paterna_id);
  const avoMat = getAnimalInfo(genealogia.avo_materno_id);
  const avoMatMae = getAnimalInfo(genealogia.avo_materna_id);

  const renderBox = (info, label) => {
    const isLink = info.id !== null;
    const content = `
      <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 4px;">${label}</div>
      <div style="font-weight: bold; color: ${isLink ? 'var(--accent-gold)' : 'inherit'};">
        ${info.nome}
      </div>
    `;
    return `
      <div class="card ${isLink ? 'cursor-pointer' : ''}" 
           style="text-align: center; border: 1px solid var(--border-color); padding: 10px; width: 150px; position: relative;"
           ${isLink ? `onclick="window.location.hash='#/animal/${info.id}'"` : ''}>
        ${content}
      </div>
    `;
  };

  return `
    <div class="pedigree-tree" style="display: flex; justify-content: space-between; align-items: center; gap: var(--spacing-xl); overflow-x: auto; padding: var(--spacing-lg);">
      <div class="tree-col" style="display: flex; flex-direction: column; justify-content: center;">
        <div class="card" style="text-align: center; border-color: var(--accent-gold); border-width: 2px; padding: 10px; width: 150px;">
          <strong>Animal Atual</strong>
        </div>
      </div>
      
      <div class="tree-col" style="display: flex; flex-direction: column; justify-content: space-around; gap: var(--spacing-xl); height: 100%;">
        ${renderBox(pai, 'Pai')}
        ${renderBox(mae, 'Mãe')}
      </div>
      
      <div class="tree-col" style="display: flex; flex-direction: column; justify-content: space-between; gap: var(--spacing-md); height: 100%;">
        ${renderBox(avoPat, 'Avô Paterno')}
        ${renderBox(avoPatMae, 'Avó Paterna')}
        ${renderBox(avoMat, 'Avô Materno')}
        ${renderBox(avoMatMae, 'Avó Materna')}
      </div>
    </div>
  `;
};
