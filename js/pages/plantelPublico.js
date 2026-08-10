import { store } from '../store.js';
import { calcularIdade, getStatusColor, formatDate } from '../utils/helpers.js';

export const renderPlantelPublico = async (container) => {
  container.innerHTML = `
    <div style="min-height: 100vh; width: 100%; background: #f5f2ed; padding: 30px 20px; font-family: 'Inter', sans-serif; box-sizing: border-box;">
      
      <!-- Public Hero Header with Rotating Video Background -->
      <div style="max-width: 1000px; width: 100%; margin: 0 auto 30px; text-align: center; background: #2c2418; padding: 40px 20px; border-radius: 16px; border: 1px solid var(--border-color); box-shadow: 0 8px 30px rgba(0,0,0,0.12); position: relative; overflow: hidden; box-sizing: border-box;">
        
        <!-- Video Element with Playlist Support -->
        <video autoplay muted playsinline id="plantel-hero-video" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.38; filter: contrast(1.1); pointer-events: none; transition: opacity 0.5s ease;">
          <source id="plantel-video-source" src="assets/plantel-bg.mp4" type="video/mp4">
        </video>

        <!-- Overlay Gradient -->
        <div style="position: absolute; inset: 0; background: linear-gradient(180deg, rgba(44,36,24,0.4) 0%, rgba(44,36,24,0.85) 100%); pointer-events: none;"></div>

        <!-- Content -->
        <div style="position: relative; z-index: 2;">
          <div style="font-size: 2.8rem; margin-bottom: 8px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));">🐴</div>
          <h1 style="font-family: 'Playfair Display', serif; color: #D4AF37; margin: 0 0 6px; font-size: 2.4rem; letter-spacing: 2px; text-shadow: 0 2px 8px rgba(0,0,0,0.6);">HARAS KNEIP</h1>
          <p style="color: rgba(255,255,255,0.9); font-size: 1.05rem; margin: 0 0 18px; font-weight: 500; letter-spacing: 1px;">Seleção & Plantel Mangalarga Marchador</p>
          <span style="display: inline-block; background: rgba(212, 175, 55, 0.2); color: #F5E6C8; border: 1px solid rgba(212, 175, 55, 0.5); font-size: 0.8rem; padding: 6px 18px; border-radius: 20px; font-weight: 600; backdrop-filter: blur(4px);">
            🏛️ Apresentação Oficial do Plantel
          </span>
        </div>
      </div>

      <!-- Content Grid -->
      <div style="max-width: 1000px; width: 100%; margin: 0 auto; box-sizing: border-box;" id="plantel-grid">
        <div style="text-align: center; color: #9e9285; padding: 40px;">Carregando apresentação do plantel...</div>
      </div>

      <!-- Public Detail Modal Overlay -->
      <div id="public-modal-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(5px); z-index: 9999; display: none; align-items: center; justify-content: center; padding: 20px;">
        <div id="public-modal-card" style="background: #ffffff; width: 100%; max-width: 520px; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.2); position: relative; animation: scaleIn 0.25s ease;">
          <!-- Close Button -->
          <button id="public-modal-close" style="position: absolute; top: 12px; right: 12px; z-index: 10; background: rgba(0,0,0,0.5); color: #fff; border: none; width: 30px; height: 30px; border-radius: 50%; font-size: 1.1rem; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
          
          <div id="public-modal-content"></div>
        </div>
      </div>

      <!-- Footer -->
      <div style="max-width: 1000px; width: 100%; margin: 40px auto 0; text-align: center; font-size: 0.8rem; color: #9e9285; border-top: 1px solid rgba(0,0,0,0.08); padding-top: 20px;">
        Haras Kneip © ${new Date().getFullYear()} — Excelência em Mangalarga Marchador
      </div>
    </div>
  `;

  // Video Playlist Rotation Logic
  const videoEl = container.querySelector('#plantel-hero-video');
  const sourceEl = container.querySelector('#plantel-video-source');
  
  const playlist = [
    'assets/plantel-bg.mp4',
    'assets/plantel-bg-2.mp4',
    'assets/plantel-bg-3.mp4'
  ];
  let currentVideoIndex = 0;

  if (videoEl && sourceEl) {
    videoEl.addEventListener('ended', () => {
      currentVideoIndex = (currentVideoIndex + 1) % playlist.length;
      sourceEl.src = playlist[currentVideoIndex];
      videoEl.load();
      videoEl.play().catch(() => {});
    });

    videoEl.addEventListener('error', () => {
      currentVideoIndex = 0;
      sourceEl.src = playlist[0];
      videoEl.load();
    });
  }

  // Modal Setup
  const modalOverlay = document.getElementById('public-modal-overlay');
  const modalContent = document.getElementById('public-modal-content');
  const modalClose = document.getElementById('public-modal-close');

  const closeModal = () => {
    modalOverlay.style.display = 'none';
  };
  modalClose.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  try {
    const [animais, genealogias] = await Promise.all([
      store.getAnimais({ em_destaque: true }),
      store.getAllGenealogias()
    ]);

    const nomeMap = {};
    animais.forEach(a => { nomeMap[a.id] = a.nome; });

    const genealogiaMap = {};
    genealogias.forEach(g => {
      genealogiaMap[g.animal_id] = {
        pai_nome: g.pai_id ? (nomeMap[g.pai_id] || null) : null,
        mae_nome: g.mae_id ? (nomeMap[g.mae_id] || null) : null
      };
    });

    const gridEl = document.getElementById('plantel-grid');

    if (animais.length === 0) {
      gridEl.innerHTML = `
        <div style="background: #fff; padding: 40px; text-align: center; border-radius: 12px; border: 1px solid rgba(0,0,0,0.08);">
          <p style="color: #6b5e50; margin: 0;">Nenhum animal está marcado para apresentação pública no momento.</p>
        </div>
      `;
      return;
    }

    gridEl.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px;">
        ${animais.map(a => {
          const gen = genealogiaMap[a.id];
          const statusColor = getStatusColor(a.status_reprodutivo);
          const initials = a.nome ? a.nome.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : 'HK';
          const sexIcon = a.sexo === 'Fêmea' ? '♀' : '♂';

          let lineageHtml = '';
          if (gen && (gen.pai_nome || gen.mae_nome)) {
            const parts = [];
            if (gen.pai_nome) parts.push(`<div><strong>Pai:</strong> ${gen.pai_nome}</div>`);
            if (gen.mae_nome) parts.push(`<div><strong>Mãe:</strong> ${gen.mae_nome}</div>`);
            lineageHtml = `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee; font-size: 0.75rem; color: #777;">${parts.join('')}</div>`;
          }

          const photoHtml = a.foto_url 
            ? `<img src="${a.foto_url}" style="width:100%; height:100%; object-fit:cover;">`
            : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#eae5d9;">
                <span style="font-family:'Playfair Display', serif; font-size:2rem; font-weight:bold; color:#a07c3a;">${initials}</span>
               </div>`;

          return `
            <div class="public-card" data-id="${a.id}" style="background: #ffffff; border-radius: 12px; border: 1px solid rgba(0,0,0,0.08); overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.04); cursor: pointer; transition: transform 0.2s ease, box-shadow 0.2s ease;">
              <div style="height: 160px; position: relative; background: #f4f1ea;">
                ${photoHtml}
                <span style="position: absolute; top: 10px; right: 10px; background: #fff; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: bold; color: #555; box-shadow: 0 2px 5px rgba(0,0,0,0.15);">
                  ${sexIcon}
                </span>
              </div>
              <div style="padding: 14px;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 6px;">
                  <h3 style="margin: 0; font-size: 1rem; color: #2c2418; font-family: 'Inter', sans-serif; font-weight: 600;">${a.nome}</h3>
                  ${a.status_reprodutivo ? `<span style="background: ${statusColor}; color: #fff; font-size: 0.6rem; padding: 3px 8px; border-radius: 10px; font-weight: bold; text-transform: uppercase;">${a.status_reprodutivo}</span>` : ''}
                </div>
                
                <div style="font-size: 0.8rem; color: #6b5e50; margin-bottom: 6px;">
                  ${a.pelagem || ''}${a.tipo_marcha ? ' • ' + a.tipo_marcha : ''}
                </div>
                
                <div style="font-size: 0.75rem; color: #9e9285; display: flex; gap: 12px;">
                  <span>${calcularIdade(a.data_nascimento)}</span>
                  ${a.registro_abccmm ? `<span>Reg: ${a.registro_abccmm}</span>` : ''}
                </div>

                ${a.premiacao ? `<div style="margin-top: 8px; font-size: 0.75rem; color: #a07c3a; font-weight: 600;">🏆 ${a.premiacao}</div>` : ''}

                ${lineageHtml}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Click handler for card modal popup
    gridEl.querySelectorAll('.public-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-id');
        const animal = animais.find(item => item.id === id);
        if (!animal) return;

        const gen = genealogiaMap[id];
        const statusColor = getStatusColor(animal.status_reprodutivo);
        const initials = animal.nome ? animal.nome.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : 'HK';

        const photoHtml = animal.foto_url 
          ? `<img src="${animal.foto_url}" style="width:100%; height:200px; object-fit:cover;">`
          : `<div style="width:100%; height:180px; display:flex; align-items:center; justify-content:center; background:#eae5d9;">
              <span style="font-family:'Playfair Display', serif; font-size:3rem; font-weight:bold; color:#a07c3a;">${initials}</span>
             </div>`;

        modalContent.innerHTML = `
          <div>
            ${photoHtml}
            <div style="padding: 20px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <h2 style="margin: 0; font-size: 1.3rem; color: #2c2418; font-family: 'Playfair Display', serif;">${animal.nome}</h2>
                ${animal.status_reprodutivo ? `<span style="background: ${statusColor}; color: #fff; font-size: 0.65rem; padding: 4px 10px; border-radius: 12px; font-weight: bold; text-transform: uppercase;">${animal.status_reprodutivo}</span>` : ''}
              </div>

              <p style="color: #a07c3a; font-weight: 600; font-size: 0.9rem; margin: 0 0 16px;">
                ${animal.pelagem || ''} • ${animal.tipo_marcha || 'Mangalarga Marchador'}
              </p>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 0.82rem; background: #f9f8f5; padding: 14px; border-radius: 10px; border: 1px solid #eee; margin-bottom: 16px;">
                <div><span style="color:#9e9285; display:block; font-size:0.75rem;">Sexo</span> <strong>${animal.sexo === 'Fêmea' ? 'Égua ♀' : 'Garanhão ♂'}</strong></div>
                <div><span style="color:#9e9285; display:block; font-size:0.75rem;">Idade</span> <strong>${calcularIdade(animal.data_nascimento)}</strong></div>
                <div><span style="color:#9e9285; display:block; font-size:0.75rem;">Registro ABCCMM</span> <strong>${animal.registro_abccmm || '--'}</strong></div>
                <div><span style="color:#9e9285; display:block; font-size:0.75rem;">Localização</span> <strong>${animal.baia_piquete || '--'}</strong></div>
              </div>

              ${gen && (gen.pai_nome || gen.mae_nome) ? `
                <div style="margin-bottom: 16px; background: #fdfbf7; padding: 12px; border-radius: 10px; border: 1px solid #f0ede8;">
                  <strong style="font-size: 0.8rem; color: #a07c3a; display: block; margin-bottom: 6px;">🧬 Genealogia (Linhagem)</strong>
                  <div style="font-size: 0.8rem; color: #555; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div><strong>Pai:</strong> ${gen.pai_nome || '--'}</div>
                    <div><strong>Mãe:</strong> ${gen.mae_nome || '--'}</div>
                  </div>
                </div>
              ` : ''}

              ${animal.premiacao ? `
                <div style="margin-bottom: 16px; background: #fffdf5; padding: 12px; border-radius: 10px; border: 1px solid #f5eacc;">
                  <strong style="font-size: 0.8rem; color: #a07c3a; display: block; margin-bottom: 4px;">🏆 Premiações / Títulos</strong>
                  <div style="font-size: 0.85rem; color: #2c2418; font-weight: 500;">${animal.premiacao}</div>
                </div>
              ` : ''}

              ${animal.observacoes ? `
                <div style="font-size: 0.8rem; color: #6b5e50;">
                  <strong style="display:block; margin-bottom: 2px;">Observações:</strong>
                  <p style="margin: 0; line-height: 1.4;">${animal.observacoes}</p>
                </div>
              ` : ''}
            </div>
          </div>
        `;

        modalOverlay.style.display = 'flex';
      });
    });

  } catch (e) {
    console.error(e);
  }
};
