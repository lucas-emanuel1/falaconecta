/* ============================================================
   api.js — única ponte entre o site e o Supabase.
   As páginas só chamam Api.enviar(...) e Api.consultar(...).
   Precisa vir DEPOIS do supabase-config.js e da biblioteca do Supabase.
   ============================================================ */
const _db = supabase.createClient(SUPABASE_URL, SUPABASE_CHAVE);

// Tipos aceitos no balde "anexos" e a extensão de cada um
const TIPOS_ARQUIVO = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'application/pdf': 'pdf', 'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

// Fotos de celular costumam ter vários MB. Aqui a imagem é reduzida (lado maior: 1600 px)
// e salva como JPEG, o que normalmente deixa o arquivo com menos de 1 MB.
async function reduzirImagem(arquivo) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(arquivo.type)) return arquivo;
  try {
    const img = await createImageBitmap(arquivo);
    const escala = Math.min(1, 1600 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * escala);
    canvas.height = Math.round(img.height * escala);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // PNG com fundo transparente vira fundo branco
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.8));
    if (!blob) return arquivo;
    return new File([blob], arquivo.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return arquivo; // se não der para reduzir, envia o original
  }
}

const Api = {
  // Salva a manifestação. Devolve { protocolo, codigo }.
  async enviar(dados) {
    const { data, error } = await _db.rpc('enviar_manifestacao', { p: dados });
    if (error) throw error;
    return data;
  },

  // Envia os arquivos para o balde privado. Devolve a lista para mandar junto com a manifestação:
  // [{ caminho, nome, tipo, tamanho }]
  async enviarArquivos(arquivos) {
    const enviados = [];
    for (const original of arquivos) {
      const arquivo = await reduzirImagem(original);
      const ext = TIPOS_ARQUIVO[arquivo.type];
      if (!ext) throw new Error('tipo_invalido');
      const caminho = `uploads/${crypto.randomUUID()}.${ext}`;
      const { error } = await _db.storage
        .from('anexos')
        .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });
      if (error) throw error;
      enviados.push({ caminho, nome: original.name, tipo: arquivo.type, tamanho: arquivo.size });
    }
    return enviados;
  },

  // Confere protocolo + código. Devolve o andamento, ou null se não bater.
  async consultar(protocolo, codigo) {
    const { data, error } = await _db.rpc('consultar_manifestacao', {
      p_protocolo: protocolo,
      p_codigo: codigo,
    });
    if (error) throw error;
    return data;
  },
};
