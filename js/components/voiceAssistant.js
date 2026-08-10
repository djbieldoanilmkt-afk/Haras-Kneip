// Voice Assistant Module for Haras Kneip - Interactive Voice Registration
import { store } from '../store.js';
import { modal } from './modal.js';

export const voiceAssistant = {
  recognition: null,
  synthesis: window.speechSynthesis,
  currentStepIndex: 0,
  data: {},
  isListening: false,
  isSpeaking: false,
  onCompleteCallback: null,

  steps: [
    {
      key: 'nome',
      label: 'Nome Completo',
      question: 'Qual é o nome completo do animal?',
      example: 'Ex: Estrela D\'Alva do Kneip',
      required: true,
      parse: (text) => text.trim()
    },
    {
      key: 'apelido',
      label: 'Apelido',
      question: 'Ele tem algum apelido?',
      example: 'Ex: Estrelinha ou Fale "Pular"',
      required: false,
      parse: (text) => (isSkip(text) ? '' : text.trim())
    },
    {
      key: 'registro_abccmm',
      label: 'Registro ABCCMM',
      question: 'Qual o número do Registro na A B C C M M?',
      example: 'Ex: 001234 ou Fale "Pular"',
      required: false,
      parse: (text) => (isSkip(text) ? '' : text.trim())
    },
    {
      key: 'sexo',
      label: 'Sexo',
      question: 'O animal é uma Égua ou um Garanhão?',
      example: 'Fale "Égua" ou "Garanhão"',
      required: true,
      parse: (text) => {
        const lower = text.toLowerCase();
        if (lower.includes('égua') || lower.includes('egua') || lower.includes('fêmea') || lower.includes('femea')) return 'Fêmea';
        if (lower.includes('garanhão') || lower.includes('garanhao') || lower.includes('macho') || lower.includes('cavalo')) return 'Macho';
        return text;
      }
    },
    {
      key: 'pelagem',
      label: 'Pelagem',
      question: 'Qual é a pelagem dele? Alazã, Baia, Castanha, Tordilha, Zaina, Pampa ou outra?',
      example: 'Ex: Castanha, Tordilha...',
      required: true,
      parse: (text) => {
        const lower = text.toLowerCase();
        if (lower.includes('alaz')) return 'Alazã';
        if (lower.includes('baia') || lower.includes('bayo')) return 'Baia';
        if (lower.includes('castanh')) return 'Castanha';
        if (lower.includes('tordilh')) return 'Tordilha';
        if (lower.includes('zain')) return 'Zaina';
        if (lower.includes('pamp')) return 'Pampa';
        if (lower.includes('rosilh')) return 'Rosilha';
        if (lower.includes('pret')) return 'Preta';
        return text.trim();
      }
    },
    {
      key: 'tipo_marcha',
      label: 'Tipo de Marcha',
      question: 'Qual é o tipo de marcha? Marcha Batida ou Marcha Picada?',
      example: 'Fale "Batida" ou "Picada"',
      required: true,
      parse: (text) => {
        const lower = text.toLowerCase();
        if (lower.includes('picad')) return 'Marcha Picada';
        if (lower.includes('batid')) return 'Marcha Batida';
        return 'Marcha Batida';
      }
    },
    {
      key: 'data_nascimento',
      label: 'Data de Nascimento',
      question: 'Qual a data de nascimento aproximada dele?',
      example: 'Ex: 15 de maio de 2020 ou Fale "Pular"',
      required: false,
      parse: (text) => {
        if (isSkip(text)) return '';
        // Try parsing years or full date
        const matchYear = text.match(/\b(19|20)\d{2}\b/);
        if (matchYear) {
          return `${matchYear[0]}-01-01`;
        }
        return '';
      }
    },
    {
      key: 'peso',
      label: 'Peso (kg)',
      question: 'Qual é o peso dele em quilos?',
      example: 'Ex: 450 quilos ou Fale "Pular"',
      required: false,
      parse: (text) => {
        if (isSkip(text)) return '';
        const match = text.match(/\d+/);
        return match ? match[0] : '';
      }
    },
    {
      key: 'altura',
      label: 'Altura (m)',
      question: 'Qual é a altura dele em metros?',
      example: 'Ex: 1 metro e 52 ou Fale "Pular"',
      required: false,
      parse: (text) => {
        if (isSkip(text)) return '';
        const match = text.match(/\d+([.,]\d+)?/);
        if (match) {
          let val = match[0].replace(',', '.');
          if (val > 10) val = (val / 100).toFixed(2); // If spoken as 152 cm
          return val;
        }
        return '';
      }
    },
    {
      key: 'baia_piquete',
      label: 'Baia / Piquete',
      question: 'Em qual baia ou piquete ele fica?',
      example: 'Ex: Piquete 2, Baia 5 ou Fale "Pular"',
      required: false,
      parse: (text) => (isSkip(text) ? '' : text.trim())
    },
    {
      key: 'status_reprodutivo',
      label: 'Status Reprodutivo',
      question: 'Qual o status reprodutivo? Prenha, Vazia, Lactante ou Garanhão Ativo?',
      example: 'Ex: Prenha, Vazia, Lactante...',
      required: false,
      parse: (text) => {
        const lower = text.toLowerCase();
        if (lower.includes('prenha') || lower.includes('prenho')) return 'Prenha';
        if (lower.includes('vazia') || lower.includes('vazio')) return 'Vazia';
        if (lower.includes('lactante')) return 'Lactante';
        if (lower.includes('cobertura')) return 'Em Cobertura';
        if (lower.includes('potro') || lower.includes('potra')) return 'Potro/Potra';
        return 'Vazia';
      }
    },
    {
      key: 'status_saude',
      label: 'Status de Saúde',
      question: 'Como está a saúde dele? Saudável, em tratamento ou observação?',
      example: 'Ex: Saudável ou Fale "Pular"',
      required: false,
      parse: (text) => (isSkip(text) ? 'Saudável' : text.trim())
    },
    {
      key: 'premiacao',
      label: 'Premiações',
      question: 'Ele tem alguma premiação ou título?',
      example: 'Ex: Campeão Nacional 2023 ou Fale "Pular"',
      required: false,
      parse: (text) => (isSkip(text) ? '' : text.trim())
    }
  ],

  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Seu navegador não suporta reconhecimento de voz nativo. Use o Google Chrome ou Edge.');
      return false;
    }
    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'pt-BR';
    this.recognition.continuous = false;
    this.recognition.interimResults = false;

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      this.handleVoiceResponse(transcript);
    };

    this.recognition.onerror = (event) => {
      console.warn('Erro no reconhecimento de voz:', event.error);
      this.updateStatus('Não entendi bem. Clique no microfone para tentar de novo.');
      this.isListening = false;
      this.renderUIState();
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.renderUIState();
    };

    return true;
  },

  speak(text, onEnd) {
    if (!this.synthesis) return;
    this.synthesis.cancel(); // Stop any active speech

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    this.isSpeaking = true;
    this.renderUIState();

    utterance.onend = () => {
      this.isSpeaking = false;
      this.renderUIState();
      if (onEnd) onEnd();
    };

    this.synthesis.speak(utterance);
  },

  startListening() {
    if (!this.recognition) {
      if (!this.initSpeechRecognition()) return;
    }
    try {
      this.recognition.start();
      this.isListening = true;
      this.updateStatus('🎙️ Ouvindo... Pode falar!');
      this.renderUIState();
    } catch (e) {
      console.warn(e);
    }
  },

  stopListening() {
    if (this.recognition) {
      try { this.recognition.stop(); } catch (e) {}
    }
    this.isListening = false;
    this.renderUIState();
  },

  startWizard(onComplete) {
    this.currentStepIndex = 0;
    this.data = { raca: 'Mangalarga Marchador' };
    this.onCompleteCallback = onComplete;

    this.showModalContainer();
    this.askCurrentStep();
  },

  askCurrentStep() {
    if (this.currentStepIndex >= this.steps.length) {
      this.finishWizard();
      return;
    }

    const step = this.steps[this.currentStepIndex];
    this.renderUIState();
    this.updateStatus('Pensando...');

    this.speak(step.question, () => {
      setTimeout(() => this.startListening(), 300);
    });
  },

  handleVoiceResponse(text) {
    console.log('Voz recebida:', text);
    const lower = text.toLowerCase().trim();

    // Global voice commands
    if (lower === 'cancelar' || lower === 'fechar' || lower === 'sair') {
      this.cancelWizard();
      return;
    }
    if (lower === 'voltar' || lower === 'passo anterior') {
      if (this.currentStepIndex > 0) {
        this.currentStepIndex--;
        this.askCurrentStep();
      }
      return;
    }

    const step = this.steps[this.currentStepIndex];
    const parsedValue = step.parse(text);

    this.data[step.key] = parsedValue;
    this.updateStatus(`Entendido: "${parsedValue || 'Pulado'}"`);

    this.currentStepIndex++;

    setTimeout(() => {
      this.askCurrentStep();
    }, 600);
  },

  skipCurrentStep() {
    const step = this.steps[this.currentStepIndex];
    this.data[step.key] = '';
    this.currentStepIndex++;
    this.askCurrentStep();
  },

  finishWizard() {
    this.speak('Ótimo! Preenchi todas as informações por voz. Agora você pode adicionar uma foto ou salvar o cadastro!', () => {
      this.closeModal();
      if (this.onCompleteCallback) {
        this.onCompleteCallback(this.data);
      }
    });
  },

  cancelWizard() {
    this.synthesis.cancel();
    this.stopListening();
    this.closeModal();
  },

  showModalContainer() {
    const modalHtml = `
      <div id="va-container" style="text-align: center; padding: 10px;">
        <div style="font-size: 3rem; margin-bottom: 10px; animation: pulse 1.5s infinite;" id="va-avatar">🎙️</div>
        <h3 id="va-step-label" style="color: var(--accent-gold); margin-bottom: 5px;">Assistente de Voz</h3>
        <p id="va-question" style="font-size: 1rem; color: var(--text-primary); margin-bottom: 15px; font-weight: 500; min-height: 40px;"></p>
        
        <div id="va-status" style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 20px; font-style: italic;">
          Iniciando...
        </div>

        <div style="display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;">
          <button id="va-btn-mic" class="btn btn-primary" style="padding: 10px 20px; font-size: 0.9rem;">
            🎙️ Falar Agora
          </button>
          <button id="va-btn-skip" class="btn btn-secondary" style="font-size: 0.85rem;">
            ⏭️ Pular Pergunta
          </button>
          <button id="va-btn-cancel" class="btn btn-ghost" style="color: var(--accent-red); font-size: 0.85rem;">
            Cancelar
          </button>
        </div>

        <div id="va-transcript-preview" style="margin-top: 15px; padding: 8px; background: var(--bg-lighter); border-radius: var(--radius-sm); font-size: 0.8rem; color: var(--text-secondary); display: none;"></div>
      </div>
    `;

    modal.open('Entrevista por Voz', modalHtml);

    document.getElementById('va-btn-mic').addEventListener('click', () => {
      if (this.isListening) {
        this.stopListening();
      } else {
        this.startListening();
      }
    });

    document.getElementById('va-btn-skip').addEventListener('click', () => {
      this.skipCurrentStep();
    });

    document.getElementById('va-btn-cancel').addEventListener('click', () => {
      this.cancelWizard();
    });
  },

  updateStatus(msg) {
    const el = document.getElementById('va-status');
    if (el) el.textContent = msg;
  },

  renderUIState() {
    const questionEl = document.getElementById('va-question');
    const labelEl = document.getElementById('va-step-label');
    const avatarEl = document.getElementById('va-avatar');
    const micBtn = document.getElementById('va-btn-mic');

    const step = this.steps[this.currentStepIndex];

    if (step && questionEl) {
      questionEl.textContent = step.question;
      labelEl.textContent = `Passo ${this.currentStepIndex + 1} de ${this.steps.length}: ${step.label}`;
    }

    if (micBtn) {
      if (this.isListening) {
        micBtn.innerHTML = '🔴 Ouvindo... (Clique para parar)';
        micBtn.style.background = 'var(--accent-red)';
      } else {
        micBtn.innerHTML = '🎙️ Falar Resposta';
        micBtn.style.background = 'var(--accent-gold)';
      }
    }

    if (avatarEl) {
      if (this.isSpeaking) {
        avatarEl.textContent = '🗣️';
      } else if (this.isListening) {
        avatarEl.textContent = '🎙️';
      } else {
        avatarEl.textContent = '🐴';
      }
    }
  },

  closeModal() {
    modal.close();
  }
};

function isSkip(text) {
  const lower = text.toLowerCase();
  return lower.includes('pular') || lower.includes('não sei') || lower.includes('nao sei') || lower.includes('próximo') || lower.includes('passar');
}
