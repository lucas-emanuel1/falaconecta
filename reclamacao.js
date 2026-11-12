const form = document.getElementById('form');
const extra = document.getElementById('extra');
const nome = document.getElementById('nome');
const email = document.getElementById('email');
const sucesso = document.getElementById('sucesso');

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
  sucesso.hidden = true;

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

  // TODO: enviar os dados para o servidor aqui (fetch/Supabase)
  console.log(Object.fromEntries(new FormData(form)));

  sucesso.hidden = false;
  form.reset();
  preview.hidden = true;
  dropzone.classList.remove('tem-foto');
  atualizarTipo();
});

// Tira o aviso de erro assim que o usuário corrige
['input', 'change'].forEach((ev) =>
  form.addEventListener(ev, (e) => {
    if (e.target.classList.contains('invalido')) limparErro(e.target);
  })
);

atualizarTipo(); // estado inicial: anônima (bloco escondido)
