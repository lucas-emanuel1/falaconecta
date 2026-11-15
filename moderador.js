const STATUS = {
  nova: 'Recebida', em_analise: 'Em análise', encaminhada: 'Encaminhada',
  em_atendimento: 'Em atendimento', concluida: 'Concluída', arquivada: 'Arquivada',
};
const TIPO = { reclamacao: 'Reclamação', sugestao: 'Sugestão' };
// Colunas liberadas no banco (o código de acesso protegido fica de fora)
const COLUNAS = 'id, protocolo, tipo, identificada, bairro, rua, referencia, categoria, descricao, foto_path, status, orgao_id, motivo_arquivamento, criada_em';

let todas = [];                 // tudo que veio do banco
let ordem = { col: 'criada_em', dir: 'desc' };
let atual = null;               // manifestação aberta nos detalhes
let orgaos = [];                // órgãos cadastrados (para encaminhar)

const $ = (id) => document.getElementById(id);
const fmt = (iso) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const tipoTexto = (m) => TIPO[m.tipo] + (m.tipo === 'reclamacao' ? (m.identificada ? ' (identificada)' : ' (anônima)') : '');

/* ---------- Proteção da página: só moderador logado ---------- */
async function iniciar() {
  const { data: { session } } = await _db.auth.getSession();
  if (!session) return sair();

  const { data: perfil } = await _db
    .from('perfis').select('nome, papel').eq('user_id', session.user.id).maybeSingle();
  if (!perfil || perfil.papel !== 'moderador') return sair();

  $('nome-moderador').textContent = perfil.nome;
  $('painel').hidden = false;
  await carregarOrgaos();
  await carregar();
}

async function sair() {
  await _db.auth.signOut();
  window.location.replace('moderador-login.html');
}
$('sair').addEventListener('click', sair);

/* ---------- Dados ---------- */
async function carregar() {
  const { data, error } = await _db
    .from('manifestacoes')
    .select(COLUNAS + ', contatos(nome, email, telefone)')
    .order('criada_em', { ascending: false })
    .limit(500);
  if (error) {
    console.error(error);
    $('erro-lista').textContent = 'Não foi possível carregar as solicitações.';
    $('erro-lista').hidden = false;
    return;
  }
  todas = data;
  preencherFiltros();
  desenhar();
}

function preencherFiltros() {
  const unicos = (campo) => [...new Set(todas.map((m) => m[campo]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  [['f-bairro', 'bairro'], ['f-categoria', 'categoria']].forEach(([id, campo]) => {
    const sel = $(id);
    const atual = sel.value;
    sel.length = 1; // mantém só o "Selecione"
    unicos(campo).forEach((v) => sel.add(new Option(v, v)));
    sel.value = atual;
  });
}

/* ---------- Filtro, busca e ordem ---------- */
function filtradas() {
  const f = {
    tipo: $('f-tipo').value, bairro: $('f-bairro').value,
    categoria: $('f-categoria').value, status: $('f-status').value,
  };
  const q = $('busca').value.trim().toLowerCase();

  let lista = todas.filter((m) =>
    (!f.tipo || m.tipo === f.tipo) &&
    (!f.bairro || m.bairro === f.bairro) &&
    (!f.categoria || m.categoria === f.categoria) &&
    (!f.status || m.status === f.status) &&
    (!q || [m.protocolo, m.categoria, m.bairro, m.rua, m.referencia, m.descricao, STATUS[m.status]]
      .some((v) => (v || '').toLowerCase().includes(q)))
  );

  const { col, dir } = ordem;
  lista.sort((a, b) => {
    const va = (col === 'status' ? STATUS[a.status] : a[col]) || '';
    const vb = (col === 'status' ? STATUS[b.status] : b[col]) || '';
    return String(va).localeCompare(String(vb), 'pt-BR', { numeric: true }) * (dir === 'asc' ? 1 : -1);
  });
  return lista;
}

function desenhar() {
  const lista = filtradas();
  const corpo = $('corpo');
  corpo.innerHTML = '';

  $('total').textContent = lista.length + (lista.length === 1 ? ' solicitação' : ' solicitações');

  if (!lista.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 9; td.className = 'vazio';
    td.textContent = 'Nenhuma solicitação encontrada.';
    tr.appendChild(td); corpo.appendChild(tr);
    return;
  }

  lista.forEach((m) => {
    const tr = document.createElement('tr');
    [m.protocolo, fmt(m.criada_em), tipoTexto(m), m.categoria, m.bairro, m.rua, m.referencia].forEach((v) => {
      const td = document.createElement('td');
      td.textContent = v || '—';
      tr.appendChild(td);
    });
    const tdS = document.createElement('td');
    const selo = document.createElement('span');
    selo.className = 'selo'; selo.textContent = STATUS[m.status];
    tdS.appendChild(selo); tr.appendChild(tdS);

    const tdV = document.createElement('td');
    const ver = document.createElement('button');
    ver.type = 'button'; ver.className = 'ver';
    ver.setAttribute('aria-label', 'Ver detalhes de ' + m.protocolo);
    ver.textContent = '👁';
    ver.addEventListener('click', () => abrirDetalhe(m));
    tdV.appendChild(ver); tr.appendChild(tdV);
    corpo.appendChild(tr);
  });
}

// Ordenar clicando no título da coluna
document.querySelectorAll('thead button').forEach((b) => {
  b.addEventListener('click', () => {
    const col = b.dataset.col;
    ordem = { col, dir: ordem.col === col && ordem.dir === 'asc' ? 'desc' : 'asc' };
    document.querySelectorAll('thead button').forEach((x) => x.removeAttribute('data-dir'));
    b.dataset.dir = ordem.dir;
    desenhar();
  });
});

$('btn-filtrar').addEventListener('click', desenhar);
$('btn-limpar').addEventListener('click', () => {
  $('filtros').reset(); $('busca').value = ''; desenhar();
});
$('busca').addEventListener('input', desenhar);

/* ---------- Detalhes ---------- */
function linhas(dl, pares) {
  dl.innerHTML = '';
  pares.forEach(([k, v]) => {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v || '—';
    dl.append(dt, dd);
  });
}

async function abrirDetalhe(m) {
  atual = m;
  $('d-titulo').textContent = m.protocolo;
  prepararAcoes(m);
  carregarAnexos(m);
  $('d-status').textContent = STATUS[m.status];
  linhas($('d-dados'), [
    ['Tipo', tipoTexto(m)], ['Enviada em', fmt(m.criada_em)], ['Categoria', m.categoria],
    ['Bairro', m.bairro], ['Rua', m.rua], ['Referência', m.referencia],
  ]);
  $('d-descricao').textContent = m.descricao || '—';

  const c = Array.isArray(m.contatos) ? m.contatos[0] : m.contatos;
  $('d-contato-area').hidden = !c;
  if (c) linhas($('d-contato'), [['Nome', c.nome], ['Email', c.email], ['Telefone', c.telefone]]);

  const hist = $('d-hist');
  hist.innerHTML = '<li>Carregando...</li>';
  if (!$('detalhe').open) $('detalhe').showModal();

  const { data, error } = await _db
    .from('historico').select('status, texto, publico, criado_em')
    .eq('manifestacao_id', m.id).order('criado_em');
  hist.innerHTML = '';
  if (error) { hist.innerHTML = '<li>Não foi possível carregar o andamento.</li>'; return; }
  data.forEach((h) => {
    const li = document.createElement('li');
    const forte = document.createElement('strong'); forte.textContent = h.status;
    li.append(forte, document.createTextNode(' — ' + h.texto));
    if (!h.publico) {
      const i = document.createElement('span'); i.className = 'interno'; i.textContent = 'interno';
      li.appendChild(i);
    }
    const t = document.createElement('time'); t.textContent = fmt(h.criado_em);
    li.appendChild(t);
    hist.appendChild(li);
  });
}
$('d-fechar').addEventListener('click', () => $('detalhe').close());
$('detalhe').addEventListener('click', (e) => { if (e.target === $('detalhe')) $('detalhe').close(); });

/* ---------- Fotos e anexos (links temporários: o balde é privado) ---------- */
async function carregarAnexos(m) {
  const area = $('d-anexos-area');
  const lista = $('d-anexos');
  area.hidden = true;
  lista.innerHTML = '';

  const { data, error } = await _db
    .from('anexos').select('caminho, nome, tipo').eq('manifestacao_id', m.id).order('id');
  if (error || !data.length || atual !== m) return;

  // Links que expiram em 5 minutos; só quem tem permissão consegue gerar
  const { data: links, error: erroLinks } = await _db.storage
    .from('anexos').createSignedUrls(data.map((a) => a.caminho), 300);
  if (erroLinks || atual !== m) return;

  data.forEach((a) => {
    const url = (links.find((l) => l.path === a.caminho) || {}).signedUrl;
    if (!url) return;
    const li = document.createElement('li');
    const link = document.createElement('a');
    link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    if ((a.tipo || '').startsWith('image/')) {
      const img = document.createElement('img');
      img.src = url; img.alt = 'Foto: ' + (a.nome || ''); img.loading = 'lazy';
      link.appendChild(img);
    } else {
      const arq = document.createElement('span');
      arq.className = 'arq'; arq.textContent = '📄 ' + (a.nome || 'arquivo');
      link.appendChild(arq);
    }
    li.appendChild(link);
    lista.appendChild(li);
  });
  area.hidden = lista.children.length === 0;
}

/* ---------- Ações do moderador ---------- */
async function carregarOrgaos() {
  const { data, error } = await _db
    .from('orgaos').select('id, nome, categorias').eq('ativo', true).order('nome');
  if (error) { console.error(error); return; }
  orgaos = data;
}

function prepararAcoes(m) {
  const area = $('d-acoes');
  const info = $('d-acoes-info');
  const form = $('d-acoes-form');
  $('a-erro').hidden = true;
  area.hidden = false;

  const aberta = m.status === 'nova' || m.status === 'em_analise';
  form.hidden = !aberta;
  info.hidden = aberta;

  if (!aberta) {
    const nomeOrgao = (orgaos.find((o) => o.id === m.orgao_id) || {}).nome;
    info.textContent = m.status === 'arquivada'
      ? 'Arquivada. Motivo: ' + (m.motivo_arquivamento || '—')
      : 'Status atual: ' + STATUS[m.status] + (nomeOrgao ? ' — ' + nomeOrgao : '') + '.';
    return;
  }

  $('a-analise').hidden = m.status !== 'nova';

  // Lista de órgãos, já com o sugerido pela categoria selecionado
  const sel = $('a-orgao');
  sel.length = 0;
  sel.add(new Option('Selecione o órgão', ''));
  orgaos.forEach((o) => sel.add(new Option(o.nome, o.id)));
  const sugerido = orgaos.find((o) => (o.categorias || []).includes(m.categoria));
  sel.value = sugerido ? sugerido.id : '';

  $('a-msg').value = '';
  $('a-motivo').value = '';
  $('a-msg-arq').value = '';
}

async function executarAcao(botao, funcao, params, mensagemConfirmacao) {
  const erro = $('a-erro');
  erro.hidden = true;
  if (mensagemConfirmacao && !confirm(mensagemConfirmacao)) return;

  const texto = botao.textContent;
  botao.disabled = true;
  botao.textContent = 'Salvando...';
  const { error } = await _db.rpc(funcao, params);
  botao.disabled = false;
  botao.textContent = texto;

  if (error) {
    console.error(error);
    const msgs = {
      status_invalido: 'Esta manifestação já foi tratada por outra ação. Atualize a página.',
      orgao_invalido: 'Órgão inválido.',
      motivo_invalido: 'Escolha o motivo.',
      sem_permissao: 'Você não tem permissão para esta ação.',
    };
    const chave = Object.keys(msgs).find((k) => (error.message || '').includes(k));
    erro.textContent = chave ? msgs[chave] : 'Não foi possível salvar agora. Tente novamente.';
    erro.hidden = false;
    return;
  }

  // Recarrega a lista e reabre os detalhes já com o novo andamento
  const id = atual.id;
  await carregar();
  const atualizada = todas.find((x) => x.id === id);
  if (atualizada) abrirDetalhe(atualizada); else $('detalhe').close();
}

$('a-analise').addEventListener('click', (e) =>
  executarAcao(e.currentTarget, 'moderador_em_analise', { p_id: atual.id }));

$('a-encaminhar').addEventListener('click', (e) => {
  const orgao = $('a-orgao').value;
  if (!orgao) { $('a-erro').textContent = 'Escolha o órgão responsável.'; $('a-erro').hidden = false; return; }
  const nome = $('a-orgao').selectedOptions[0].textContent;
  executarAcao(e.currentTarget, 'moderador_encaminhar',
    { p_id: atual.id, p_orgao: orgao, p_texto: $('a-msg').value },
    'Encaminhar esta manifestação para: ' + nome + '?');
});

$('a-arquivar').addEventListener('click', (e) => {
  const motivo = $('a-motivo').value;
  if (!motivo) { $('a-erro').textContent = 'Escolha o motivo do arquivamento.'; $('a-erro').hidden = false; return; }
  executarAcao(e.currentTarget, 'moderador_arquivar',
    { p_id: atual.id, p_motivo: motivo, p_texto: $('a-msg-arq').value },
    'Arquivar esta manifestação? O cidadão verá o motivo no acompanhamento.');
});

iniciar();
