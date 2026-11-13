const form = document.getElementById('form');
const extra = document.getElementById('extra');
const nome = document.getElementById('nome');
const email = document.getElementById('email');

/* ---------- Anônima x Identificada ---------- */
function atualizarTipo() {
  const identificada = form.tipo.value === 'identificada';
  extra.hidden = !identificada;              // esconde/mostra o bloco "Queremos conhecer você!"
  if (!identificada) {                       // anônima: apaga o que foi digitado e os erros
    extra.querySelectorAll('input').forEach((i) => { i.value = ''; });
    limparErro(nome);
    limparErro(email);
  }
}
form.querySelectorAll('input[name="tipo"]').forEach((r) => r.addEventListener('change', atualizarTipo));

/* ---------- Pré-visualização da foto ---------- */
const foto = document.getElementById('foto');
const preview = document.getElementById('preview');
const dropzone = document.querySelector('.dropzone');
foto.addEventListener('change', () => {
  const arquivo = foto.files[0];
  preview.hidden = !arquivo;
  dropzone.classList.toggle('tem-foto', !!arquivo);
  if (arquivo) preview.src = URL.createObjectURL(arquivo);
});

/* ---------- Validação ---------- */
const msgDe = (campo) => campo.closest('.campo, .opcao').querySelector('.erro');
function mostrarErro(campo) { campo.classList.add('invalido'); msgDe(campo).hidden = false; }
function limparErro(campo) { campo.classList.remove('invalido'); msgDe(campo).hidden = true; }

form.addEventListener('submit', (e) => {
  e.preventDefault();

  const regras = [
    [document.getElementById('bairro'), (c) => c.value !== ''],
    [document.getElementById('categoria'), (c) => c.value !== ''],
    [document.getElementById('aceite'), (c) => c.checked],
  ];
  // Nome e email só são exigidos na reclamação identificada
  if (form.tipo.value === 'identificada') {
    regras.push(
      [nome, (c) => c.value.trim().length > 2],
      [email, (c) => /^\S+@\S+\.\S+$/.test(c.value.trim())]
    );
  }

  let primeiro = null;
  regras.forEach(([campo, ok]) => {
    if (ok(campo)) limparErro(campo);
    else { mostrarErro(campo); primeiro = primeiro || campo; }
  });
  if (primeiro) { primeiro.focus(); return; }

  // 1) Descobre qual opção está marcada: "anonima" ou "identificada"
  const tipo = form.tipo.value;

  // TODO: enviar os dados ao servidor (fetch/Supabase). O protocolo e o código
  // reais devem vir da resposta do servidor, no lugar de dadosDeTeste().
  const dados = Object.fromEntries(new FormData(form));
  console.log(dados);
  const resposta = dadosDeTeste();

  form.reset();
  preview.hidden = true;
  dropzone.classList.remove('tem-foto');
  atualizarTipo();

  // 2) Abre o modal certo para o tipo escolhido
  abrirModal(tipo, resposta);
});

/* ---------- Modal ---------- */
const modal = document.getElementById('modal');

const TEXTOS = {
  anonima: {
    titulo: 'Manifestação enviada!',
    texto: 'Sua reclamação foi registrada com sucesso. Guarde os dados abaixo para acompanhar o andamento.',
  },
  identificada: {
    titulo: 'Manifestação registrada com sucesso!',
    texto: 'Enviamos um protocolo e uma chave de acesso para o email cadastrado, utilize-os para acompanhar o seu processo.',
  },
};

function abrirModal(tipo, { protocolo, codigo }) {
  const t = TEXTOS[tipo];
  document.getElementById('modal-titulo').textContent = t.titulo;
  document.getElementById('modal-texto').textContent = t.texto;
  document.getElementById('m-protocolo').textContent = protocolo;
  document.getElementById('m-codigo').textContent = codigo;
  modal.showModal();
}

// X, "Encerrar", tecla Esc e clique fora fecham o modal; ao fechar, volta para o início
modal.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', () => modal.close()));
modal.addEventListener('click', (e) => { if (e.target === modal) modal.close(); });
modal.addEventListener('close', () => { window.location.href = 'index.html'; });

// Botões de copiar
modal.querySelectorAll('.copiar').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const texto = document.getElementById(btn.dataset.alvo).textContent;
    try {
      await navigator.clipboard.writeText(texto);
      btn.classList.add('copiado');
      setTimeout(() => btn.classList.remove('copiado'), 1500);
    } catch {
      alert('Não foi possível copiar. Selecione o texto e copie manualmente.');
    }
  });
});

/* ---------- Dados de teste (APAGAR quando ligar o servidor) ---------- */
function dadosDeTeste() {
  const ano = new Date().getFullYear();
  const numero = String(Math.floor(Math.random() * 99999) + 1).padStart(5, '0');
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const s = [...crypto.getRandomValues(new Uint8Array(8))].map((n) => letras[n % letras.length]).join('');
  return { protocolo: `SB-${ano}-${numero}`, codigo: `${s.slice(0, 4)}-${s.slice(4)}` };
}

// Tira o aviso de erro assim que o usuário corrige
['input', 'change'].forEach((ev) =>
  form.addEventListener(ev, (e) => {
    if (e.target.classList.contains('invalido')) limparErro(e.target);
  })
);

atualizarTipo(); // estado inicial: anônima (bloco escondido)
