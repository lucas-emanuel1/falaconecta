const STATUS = {
  nova: 'Recebida', em_analise: 'Em análise', encaminhada: 'Encaminhada',
  em_atendimento: 'Em atendimento', concluida: 'Concluída', arquivada: 'Arquivada',
};
const TIPO = { reclamacao: 'Reclamação', sugestao: 'Sugestão' };
// Colunas liberadas no banco (o código de acesso protegido fica de fora)
const COLUNAS = 'id, protocolo, tipo, bairro, rua, referencia, categoria, descricao, status, orgao_id, criada_em';

let todas = [];
let ordem = { col: 'criada_em', dir: 'desc' };
let atual = null;

const $ = (id) => document.getElementById(id);
const fmt = (iso) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/* ---------- Proteção: só usuário de órgão logado ---------- */
async function iniciar() {
  const { data: { session } } = await _db.auth.getSession();
  if (!session) return sair();

  const { data: perfil } = await _db
    .from('perfis').select('nome, papel, orgao_id').eq('user_id', session.user.id).maybeSingle();
  if (!perfil || perfil.papel !== 'orgao') return sair();

  const { data: orgao } = await _db.from('orgaos').select('nome').eq('id', perfil.orgao_id).maybeSingle();
  $('nome-usuario').textContent = perfil.nome;
  $('nome-orgao').textContent = orgao ? orgao.nome : '';
  $('painel').hidden = false;
  await carregar();
}

async function sair() {
  await _db.auth.signOut();
  window.location.replace('moderador-login.html');
}
$('sair').addEventListener('click', sair);

/* ---------- Dados (o banco já entrega só o que é deste órgão) ---------- */
async function carregar() {
  const { data, error } = await _db
    .from('manifestacoes').select(COLUNAS).order('criada_em', { ascending: false }).limit(500);
  if (error) {
    console.error(error);
    $('erro-lista').textContent = 'Não foi possível carregar as solicitações.';
    $('erro-lista').hidden = false;
    return;
  }
  todas = data;
  const sel = $('f-categoria');
  const atualSel = sel.value;
  sel.length = 1;
  [...new Set(todas.map((m) => m.categoria).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR')).forEach((c) => sel.add(new Option(c, c)));
  sel.value = atualSel;
  desenhar();
}

function filtradas() {
  const st = $('f-status').value, cat = $('f-categoria').value;
  const q = $('busca').value.trim().toLowerCase();
  const lista = todas.filter((m) =>
    (!st || m.status === st) && (!cat || m.categoria === cat) &&
    (!q || [m.protocolo, m.categoria, m.bairro, m.rua, m.referencia, m.descricao, STATUS[m.status]]
      .some((v) => (v || '').toLowerCase().includes(q))));
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
    const tr = document.createElement('tr'), td = document.createElement('td');
    td.colSpan = 8; td.className = 'vazio'; td.textContent = 'Nenhuma solicitação encontrada.';
    tr.appendChild(td); corpo.appendChild(tr);
    return;
  }
  lista.forEach((m) => {
    const tr = document.createElement('tr');
    [m.protocolo, fmt(m.criada_em), m.categoria, m.bairro, m.rua, m.referencia].forEach((v) => {
      const td = document.createElement('td'); td.textContent = v || '—'; tr.appendChild(td);
    });
    const tdS = document.createElement('td'), selo = document.createElement('span');
    selo.className = 'selo'; selo.textContent = STATUS[m.status]; tdS.appendChild(selo); tr.appendChild(tdS);

    const tdV = document.createElement('td'), ver = document.createElement('button');
    ver.type = 'button'; ver.className = 'ver'; ver.textContent = '👁';
    ver.setAttribute('aria-label', 'Ver detalhes de ' + m.protocolo);
    ver.addEventListener('click', () => abrirDetalhe(m));
    tdV.appendChild(ver); tr.appendChild(tdV); corpo.appendChild(tr);
  });
}

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
$('btn-limpar').addEventListener('click', () => { $('filtros').reset(); $('busca').value = ''; desenhar(); });
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
  $('d-status').textContent = STATUS[m.status];
  linhas($('d-dados'), [
    ['Tipo', TIPO[m.tipo]], ['Enviada em', fmt(m.criada_em)], ['Categoria', m.categoria],
    ['Bairro', m.bairro], ['Rua', m.rua], ['Referência', m.referencia],
  ]);
  $('d-descricao').textContent = m.descricao || '—';
  prepararAcoes(m);
  carregarAnexos(m);

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
      const i = document.createElement('span'); i.className = 'interno'; i.textContent = 'interno'; li.appendChild(i);
    }
    const t = document.createElement('time'); t.textContent = fmt(h.criado_em); li.appendChild(t);
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

/* ---------- Ações do órgão ---------- */
function prepararAcoes(m) {
  $('a-erro').hidden = true;
  $('d-acoes').hidden = false;
  const emAberto = m.status === 'encaminhada' || m.status === 'em_atendimento';
  $('d-acoes-form').hidden = !emAberto;
  $('d-acoes-info').hidden = emAberto;
  if (!emAberto) { $('d-acoes-info').textContent = 'Esta solicitação já foi concluída.'; return; }

  $('a-iniciar').hidden = m.status !== 'encaminhada';
  $('box-concluir').hidden = m.status !== 'em_atendimento';
  $('a-resposta').value = '';
  $('a-motivo').value = '';
}

async function executarAcao(botao, funcao, params, confirmacao) {
  const erro = $('a-erro');
  erro.hidden = true;
  if (confirmacao && !confirm(confirmacao)) return;

  const texto = botao.textContent;
  botao.disabled = true; botao.textContent = 'Salvando...';
  const { error } = await _db.rpc(funcao, params);
  botao.disabled = false; botao.textContent = texto;

  if (error) {
    console.error(error);
    const msgs = {
      status_invalido: 'O status desta solicitação mudou. Atualize a página.',
      resposta_invalida: 'Escreva a resposta para o cidadão (mínimo de 5 caracteres).',
      motivo_invalido: 'Escreva o motivo da devolução (mínimo de 5 caracteres).',
      sem_permissao: 'Você não tem permissão para esta ação.',
    };
    const chave = Object.keys(msgs).find((k) => (error.message || '').includes(k));
    erro.textContent = chave ? msgs[chave] : 'Não foi possível salvar agora. Tente novamente.';
    erro.hidden = false;
    return;
  }

  const id = atual.id;
  await carregar();
  const atualizada = todas.find((x) => x.id === id);
  if (atualizada) abrirDetalhe(atualizada); else $('detalhe').close(); // devolvida: sai da lista
}

$('a-iniciar').addEventListener('click', (e) =>
  executarAcao(e.currentTarget, 'orgao_iniciar', { p_id: atual.id }));
$('a-concluir').addEventListener('click', (e) =>
  executarAcao(e.currentTarget, 'orgao_concluir', { p_id: atual.id, p_resposta: $('a-resposta').value },
    'Concluir esta solicitação? O cidadão verá a resposta no acompanhamento.'));
$('a-devolver').addEventListener('click', (e) =>
  executarAcao(e.currentTarget, 'orgao_devolver', { p_id: atual.id, p_motivo: $('a-motivo').value },
    'Devolver ao moderador? A solicitação sairá da sua lista.'));

iniciar();
