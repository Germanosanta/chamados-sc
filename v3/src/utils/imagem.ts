/** Limite do base64 de cada foto gravada no Firestore (o documento aceita
 * até 1 MB; a regra de irrigacao_fotos confere o mesmo valor). */
export const LIMITE_FOTO_BASE64 = 700_000;

function carregarImagem(arquivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('arquivo de imagem inválido'));
    };
    img.src = url;
  });
}

/** Redimensiona e comprime para JPEG até caber em LIMITE_FOTO_BASE64. */
export async function comprimirImagem(arquivo: File, ladoMaximo = 1280): Promise<string> {
  if (!arquivo.type.startsWith('image/')) throw new Error('envie uma imagem (JPG, PNG…)');
  const img = await carregarImagem(arquivo);
  let lado = ladoMaximo;
  for (let tentativa = 0; tentativa < 6; tentativa += 1) {
    const escala = Math.min(1, lado / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * escala);
    canvas.height = Math.round(img.height * escala);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('navegador sem suporte a imagens');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const qualidade of [0.75, 0.6, 0.45]) {
      const dados = canvas.toDataURL('image/jpeg', qualidade);
      if (dados.length <= LIMITE_FOTO_BASE64) return dados;
    }
    lado = Math.round(lado * 0.7);
  }
  throw new Error('imagem grande demais mesmo após compressão');
}
