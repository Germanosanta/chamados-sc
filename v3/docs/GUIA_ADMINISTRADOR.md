# Guia do Administrador — Central de Chamados V3

Para perfis **Administrador** e **Gestor** (nome interno `supervisor`).
Ver `PERMISSOES.md` para o que cada perfil enxerga exatamente.

## Usuários (`/usuarios` — só Administrador)

- **Novo Usuário**: nome, login, e-mail, senha (mín. 6 caracteres),
  cargo, perfil de acesso e grade de permissões granulares. Escolher um
  perfil já aplica o conjunto padrão de permissões dele — dá para
  ajustar manualmente depois (override fica salvo no usuário).
- A conta é criada de verdade no Firebase Authentication, não só um
  registro no Firestore.
- **Editar Usuário**: e-mail não pode ser alterado depois de criado.
  Botão "Enviar link de redefinição" dispara e-mail de reset de senha —
  a V3 nunca mostra nem redefine a senha diretamente.
- **Ativar/Desativar**: usuário inativo perde a sessão na próxima vez
  que tentar entrar (mesmo com credencial válida). Você não consegue
  desativar a própria conta.

## Configurações (`/config` — só Administrador)

Parâmetros gerais do sistema.

## Auditoria e Logs (`/auditoria`)

Log de toda ação sensível: abertura, atribuição, mudança de status,
encerramento, reabertura, criação/edição de usuário. O mesmo log
filtrado por chamado também aparece dentro do Centro Operacional de cada
chamado (aba "Auditoria").

## Técnicos — RH (`/tecnicos`)

Cadastro de equipe técnica (nome, apelido, telefone, e-mail, área,
cargo, status, admissão). **O apelido é a chave usada para casar com o
campo "Responsável" dos chamados** — trocar o apelido de um técnico
ativo quebra esse vínculo para chamados já atribuídos a ele. A tela
também mostra ranking de total/encerrados/pendentes/tempo médio por
técnico, calculado sobre os chamados reais.

Só técnicos com status diferente de "Inativo" aparecem como opção de
Responsável em qualquer formulário do sistema (Novo Chamado, filtros,
reatribuição, checklist de encerramento).

## Equipamentos (`/equipamentos`, `/frotas`, `/pecas`, `/kb`)

- **Cadastro**: base de equipamentos (estática + overrides editáveis).
  Clique numa linha para abrir a Ficha completa (KPIs + histórico de
  chamados + atalho "Abrir Chamado" pré-preenchido).
- **Por Frota**: mesmo dado, visão de analytics/histórico agrupado.
- **Peças e Estoque**: cadastro de peças + movimentação de entrada/saída
  com saldo antes/depois registrado.
- **Banco de Soluções**: base de problema→solução reaproveitável.

## Relatórios (`/pormes`, `/responsaveis`, `/auditoria`)

Por Mês (evolução por cultura + heatmap), Responsáveis (atendimentos por
pessoa) e Auditoria — todos calculados em tempo real sobre os mesmos
dados, sem relatório pré-processado.
