# Guia do Técnico — Central de Chamados V3

## Área do Técnico (`/area-tecnico`)

Seu painel pessoal: chamados em que você está envolvido (como
responsável ou já atuou), separados por urgentes, em atendimento,
aguardando peça e concluídos por você. É a tela mais rápida para achar
"o que eu preciso fazer agora".

## Abrindo um chamado (`/novo`)

Formulário em blocos — os únicos campos obrigatórios são: equipamento
(buscado por código ou nome), categoria, fazenda/sistema, pelo menos um
responsável e a descrição do problema. O resto (prioridade, técnico
designado, status inicial, observações, fotos, peças) é opcional. Ao
buscar o equipamento, o histórico recente dele aparece automaticamente —
útil para ver se o mesmo problema já aconteceu antes.

## Atendendo um chamado — Centro Operacional

Abre clicando em qualquer chamado, em qualquer lista. Ações disponíveis
(conforme sua permissão):

- **Assumir** — marca você como responsável por esse atendimento.
- **Iniciar** / **Solicitar Peça** / **Peça Recebida** / **Observação** —
  registram um evento na linha do tempo do chamado; alguns pedem uma
  descrição curta antes de confirmar.
- **Encerrar** — abre o checklist obrigatório (técnico(s) que
  atenderam, solução, materiais usados, equipamentos, observações + 4
  itens de confirmação: problema resolvido, teste realizado, equipamento
  liberado, usuário informado). Um chamado não fecha sem esse checklist.
- **Reabrir** (em chamados já encerrados) — exige a mesma confirmação
  explícita, nunca é uma mudança de status silenciosa.

Fotos/anexos ficam disponíveis na galeria lateral; a auditoria daquele
chamado específico aparece no fim do modal.

## Chamados em Aberto (`/aberto`) — Lista e Kanban

Alterne entre lista (com filtros, incluindo "Filtros avançados") e
Kanban (arrastar card entre colunas). Cada card/linha sempre mostra o
**número do chamado junto com o código/frota do equipamento** — é assim
que você confirma que está mexendo no chamado certo antes de agir.

Arrastar um card para "Concluído" (ou de "Concluído" para outra coluna)
não muda o status direto — abre o Centro Operacional daquele chamado,
porque encerrar/reabrir sempre passam pelo checklist/confirmação acima.

## Peças

Ao abrir um chamado ou registrar atendimento, peças usadas do estoque
dão baixa automática — a movimentação fica registrada com o número do
chamado vinculado.
