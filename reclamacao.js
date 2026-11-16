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
const FOTO_TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const FOTO_MAX_MB = 20; // a foto é reduzida antes de enviar
const erroFoto = document.getElementById('erro-foto');

foto.addEventListener('change', () => {
  const arquivo = foto.files[0];
  erroFoto.hidden = true;

  if (arquivo && !FOTO_TIPOS.includes(arquivo.type)) {
    erroFoto.textContent = 'Formato não aceito. Use uma foto JPG, PNG ou WebP.';
    erroFoto.hidden = false;
    foto.value = '';
  } else if (arquivo && arquivo.size > FOTO_MAX_MB * 1024 * 1024) {
    erroFoto.textContent = `A foto passa de ${FOTO_MAX_MB} MB. Escolha uma menor.`;
    erroFoto.hidden = false;
    foto.value = '';
  }

  const ok = foto.files[0];
  preview.hidden = !ok;
  dropzone.classList.toggle('tem-foto', !!ok);
  if (ok) preview.src = URL.createObjectURL(ok);
});

/* ---------- Câmera (celular/tablet) ---------- */
// "capture" abre direto a câmera. É um campo separado para a galeria continuar disponível
// (a pessoa pode ter tirado a foto antes, sem internet, e enviar depois).
const fotoCamera = document.getElementById('foto-camera');
const btnCamera = document.getElementById('btn-camera');
if (window.matchMedia('(pointer: coarse)').matches) btnCamera.hidden = false; // só em telas de toque
btnCamera.addEventListener('click', () => fotoCamera.click());
fotoCamera.addEventListener('change', () => {
  const arquivo = fotoCamera.files[0];
  if (!arquivo) return;
  const dt = new DataTransfer();
  dt.items.add(arquivo);
  foto.files = dt.files;                      // passa a foto para o campo principal
  fotoCamera.value = '';
  foto.dispatchEvent(new Event('change'));    // reaproveita a validação e a pré-visualização
});

/* ---------- Validação ---------- */
const msgDe = (campo) => campo.closest('.campo, .opcao').querySelector('.erro');
function mostrarErro(campo) { campo.classList.add('invalido'); msgDe(campo).hidden = false; }
function limparErro(campo) { campo.classList.remove('invalido'); msgDe(campo).hidden = true; }

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (form.site && form.site.value) return; // campo-isca preenchido: é um robô, ignora em silêncio

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

  const f = Object.fromEntries(new FormData(form));
  const payload = {
    tipo: 'reclamacao',
    identificada: tipo === 'identificada',
    bairro: f.bairro,
    rua: f.rua,
    referencia: f.referencia,
    categoria: f.categoria,
    descricao: f.descricao,
    // Nome, email e telefone só vão se a pessoa escolheu se identificar
    ...(tipo === 'identificada' ? { nome: f.nome, email: f.email, telefone: f.telefone } : {}),
  };

  const botao = form.querySelector('.enviar');
  const textoBotao = botao.textContent;
  botao.disabled = true;
  botao.textContent = 'Enviando...';

  let resposta;
  try {
    // 1) envia a foto (se tiver) para o balde privado; 2) envia a manifestação com a lista
    if (foto.files[0]) payload.anexos = await Api.enviarArquivos([foto.files[0]]);
    resposta = await Api.enviar(payload); // { protocolo, codigo } vindos do servidor
  } catch (err) {
    console.error(err);
    alert(String(err && err.message).includes('limite_excedido')
      ? 'Muitos envios em pouco tempo. Tente novamente mais tarde.'
      : 'Não foi possível enviar agora. Tente novamente em instantes.');
    return;
  } finally {
    botao.disabled = false;
    botao.textContent = textoBotao;
  }

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
    texto: 'Sua reclamação foi registrada com sucesso. Guarde os dados abaixo para acompanhar o andamento. Não será possível recuperar o código depois.',
  },
  identificada: {
    titulo: 'Manifestação registrada com sucesso!',
    // TEXTO TEMPORÁRIO: o envio por email ainda não existe. Quando existir, volte para:
    // 'Enviamos um protocolo e uma chave de acesso para o email cadastrado, utilize-os para acompanhar o seu processo.'
    texto: 'Guarde o protocolo e o código de acesso abaixo para acompanhar o seu processo. Não será possível recuperar o código depois.',
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


// Tira o aviso de erro assim que o usuário corrige
['input', 'change'].forEach((ev) =>
  form.addEventListener(ev, (e) => {
    if (e.target.classList.contains('invalido')) limparErro(e.target);
  })
);

atualizarTipo(); // estado inicial: anônima (bloco escondido)
