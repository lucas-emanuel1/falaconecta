const form = document.getElementById('form');
const tipo = document.getElementById('tipo');
const descricao = document.getElementById('descricao');
const inputArquivos = document.getElementById('arquivos');
const lista = document.getElementById('lista-arquivos');
const erroArquivos = document.getElementById('erro-arquivos');
const sucesso = document.getElementById('sucesso');

const MAX_ARQUIVOS = 5;
const MAX_MB = 5;
const TIPOS_OK = /^(image\/|application\/pdf$|application\/msword$|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document$)/;

let arquivos = []; // arquivos escolhidos (o input sozinho não deixa remover um por um)

/* ---------- Anexos ---------- */
function sincronizarInput() {
  const dt = new DataTransfer();
  arquivos.forEach((f) => dt.items.add(f));
  inputArquivos.files = dt.files;
}

function desenharLista() {
  lista.innerHTML = '';
  arquivos.forEach((f, i) => {
    const li = document.createElement('li');
    const nome = document.createElement('span');
    nome.textContent = f.name;
    const remover = document.createElement('button');
    remover.type = 'button';
    remover.setAttribute('aria-label', 'Remover ' + f.name);
    remover.textContent = '×';
    remover.addEventListener('click', () => {
      arquivos.splice(i, 1);
      sincronizarInput();
      desenharLista();
      erroArquivos.hidden = true;
    });
    li.append(nome, remover);
    lista.appendChild(li);
  });
}

inputArquivos.addEventListener('change', () => {
  const problemas = [];
  [...inputArquivos.files].forEach((f) => {
    if (!TIPOS_OK.test(f.type)) problemas.push(`"${f.name}" não é um tipo permitido.`);
    else if (f.size > MAX_MB * 1024 * 1024) problemas.push(`"${f.name}" passa de ${MAX_MB} MB.`);
    else if (arquivos.length >= MAX_ARQUIVOS) problemas.push(`Limite de ${MAX_ARQUIVOS} arquivos atingido.`);
    else arquivos.push(f);
  });
  sincronizarInput();
  desenharLista();
  erroArquivos.textContent = problemas.join(' ');
  erroArquivos.hidden = problemas.length === 0;
});

/* ---------- Validação ---------- */
const msgDe = (campo) => campo.closest('.campo').querySelector('.erro');
function mostrarErro(campo) { campo.classList.add('invalido'); msgDe(campo).hidden = false; }
function limparErro(campo) { campo.classList.remove('invalido'); msgDe(campo).hidden = true; }

form.addEventListener('submit', (e) => {
  e.preventDefault();
  sucesso.hidden = true;

  const regras = [
    [tipo, (c) => c.value !== ''],
    [descricao, (c) => c.value.trim().length >= 10],
  ];
  let primeiro = null;
  regras.forEach(([campo, ok]) => {
    if (ok(campo)) limparErro(campo);
    else { mostrarErro(campo); primeiro = primeiro || campo; }
  });
  if (primeiro) { primeiro.focus(); return; }

  // TODO: enviar os dados ao servidor aqui (fetch/Supabase)
  console.log({ tipo: tipo.value, descricao: descricao.value.trim(), arquivos: arquivos.map((f) => f.name) });

  sucesso.hidden = false;
  form.reset();
  arquivos = [];
  desenharLista();
});

// Tira o aviso de erro assim que o usuário corrige
['input', 'change'].forEach((ev) =>
  form.addEventListener(ev, (e) => {
    if (e.target.classList.contains('invalido')) limparErro(e.target);
  })
);
