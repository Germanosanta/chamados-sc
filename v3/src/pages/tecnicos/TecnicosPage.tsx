import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Link2, Plus } from 'lucide-react';
import { KpiCard } from '@/components/shared/KpiCard';
import { FilterBar } from '@/components/shared/FilterBar';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Campo } from '@/components/shared/FormField';
import { useTecnicos, useTecnicosDuplicados, useSalvarTecnico, useVincularTecnicos } from '@/hooks/useTecnicos';
import { useUsuarios } from '@/hooks/useUsuarios';
import { useChamados } from '@/hooks/useChamados';
import { useSessionStore } from '@/store/session';
import { chamadoPertenceATecnico, isFechado } from '@/utils/chamado-helpers';
import type { Tecnico } from '@/types/tecnico';

const SEM_VINCULO = 'sem-vinculo';

/** Cadastro de Técnicos (RH) — portado de renderTecnicos()/salvarTec()
 * (config/index.js). Distinto de "Área do Técnico" (workspace pessoal):
 * esta é a tela administrativa de equipe, com ranking de performance.
 *
 * `usuarioUid` (ver types/tecnico.ts) é o vínculo oficial com a conta de
 * login correspondente (usuarios/{uid}) — nunca digitado à mão, só
 * escolhido num seletor restrito a contas com perfil "tecnico" ativas.
 * "Assumir Chamado" continua decidido pela própria conta logada (não
 * depende deste vínculo) — este campo é o que permite à reatribuição
 * administrativa gravar o uid certo e aos relatórios de produtividade
 * contar os chamados de cada técnico por UID em vez de nome/e-mail. */
export function TecnicosPage() {
  const { data: tecnicos, carregando } = useTecnicos();
  const duplicatas = useTecnicosDuplicados();
  const { data: usuarios } = useUsuarios();
  const { data: chamados } = useChamados();
  const salvar = useSalvarTecnico();
  const vincular = useVincularTecnicos();
  const usuarioLogado = useSessionStore((s) => s.usuario);
  const souAdmin = usuarioLogado?.perfil === 'admin';

  const [busca, setBusca] = useState('');
  const [open, setOpen] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Tecnico>>({});

  const usuariosPorId = useMemo(() => new Map(usuarios.map((u) => [u.id, u])), [usuarios]);
  const usuariosElegiveis = useMemo(
    () => usuarios.filter((u) => u.perfil === 'tecnico' && u.status === 'Ativo').sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [usuarios],
  );

  // Itera técnicos × chamados usando chamadoPertenceATecnico (UID quando
  // o técnico já está vinculado, nome como fallback só pra cadastros
  // ainda não migrados) — antes agrupava direto por texto de `resp`,
  // que sub-contava qualquer divergência de grafia entre o cadastro e o
  // nome gravado no chamado.
  const stats = useMemo(() => {
    const m = new Map<string, { total: number; encerrados: number; pendentes: number; somaDias: number; cntDias: number }>();
    for (const t of tecnicos) {
      const acc = { total: 0, encerrados: 0, pendentes: 0, somaDias: 0, cntDias: 0 };
      for (const c of chamados) {
        if (!chamadoPertenceATecnico(c, t)) continue;
        acc.total++;
        if (isFechado(c)) {
          acc.encerrados++;
          if (c.encerramento?.encerradoEm && c.data) {
            const dias = Math.round((new Date(c.encerramento.encerradoEm).getTime() - new Date(c.data + 'T00:00').getTime()) / 86400000);
            if (dias >= 0) {
              acc.somaDias += dias;
              acc.cntDias++;
            }
          }
        } else {
          acc.pendentes++;
        }
      }
      m.set(t.apelido || t.nome, acc);
    }
    return m;
  }, [tecnicos, chamados]);

  const maisProdutivo = useMemo(() => {
    let melhor: { nome: string; encerrados: number } | null = null;
    for (const t of tecnicos) {
      const s = stats.get(t.apelido || t.nome);
      if (s && (!melhor || s.encerrados > melhor.encerrados)) melhor = { nome: t.nome, encerrados: s.encerrados };
    }
    return melhor?.nome || '—';
  }, [tecnicos, stats]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return tecnicos;
    return tecnicos.filter((t) => t.nome.toLowerCase().includes(q) || (t.apelido || '').toLowerCase().includes(q));
  }, [tecnicos, busca]);

  function abrirNovo() {
    setEditKey(null);
    setForm({ status: 'Ativo' });
    setOpen(true);
  }

  function abrirEditar(t: Tecnico) {
    setEditKey(t.key);
    setForm(t);
    setOpen(true);
  }

  async function handleSalvar() {
    if (!form.nome?.trim()) {
      toast.error('O nome completo é obrigatório.');
      return;
    }
    try {
      await salvar.mutateAsync({
        key: editKey,
        tecnico: {
          nome: form.nome.trim(),
          apelido: form.apelido?.trim() || '',
          telefone: form.telefone?.trim() || '',
          email: form.email?.trim() || '',
          area: form.area || '',
          cargo: form.cargo || '',
          status: (form.status as Tecnico['status']) || 'Ativo',
          admissao: form.admissao || '',
          obs: form.obs?.trim() || '',
          usuarioUid: form.usuarioUid || null,
        },
      });
      toast('✓ Técnico salvo no cadastro!');
      setOpen(false);
    } catch {
      toast.error('Não foi possível salvar.');
    }
  }

  async function handleVincular() {
    try {
      const r = await vincular.mutateAsync({ tecnicos, usuarios });
      if (r.vinculados.length === 0 && r.naoVinculados.length === 0) {
        toast('Todos os técnicos já estavam vinculados.');
        return;
      }
      const partes: string[] = [];
      if (r.vinculados.length) partes.push(`${r.vinculados.length} vinculado(s) agora: ${r.vinculados.map((v) => v.tecnico.nome).join(', ')}`);
      if (r.naoVinculados.length) partes.push(`${r.naoVinculados.length} sem conta correspondente: ${r.naoVinculados.map((t) => t.nome).join(', ')}`);
      toast(partes.join(' · ') || 'Nenhuma vinculação pendente.');
    } catch {
      toast.error('Não foi possível rodar a vinculação automática.');
    }
  }

  const columns: DataTableColumn<Tecnico>[] = [
    { key: 'nome', header: 'Nome', render: (t) => <span className="font-medium text-foreground">{t.nome}</span> },
    { key: 'apelido', header: 'Apelido', render: (t) => t.apelido || '—' },
    { key: 'area', header: 'Área', render: (t) => t.area || '—' },
    { key: 'cargo', header: 'Cargo', render: (t) => t.cargo || '—' },
    { key: 'status', header: 'Status', render: (t) => <Badge variant={t.status === 'Ativo' ? 'green' : t.status === 'Férias' ? 'amber' : 'neutral'}>{t.status}</Badge> },
    {
      key: 'usuario',
      header: 'Usuário Vinculado',
      render: (t) =>
        t.usuarioUid ? (
          usuariosPorId.get(t.usuarioUid) ? (
            <span className="inline-flex items-center gap-1 text-foreground">
              <Link2 className="h-3 w-3 text-success" /> {usuariosPorId.get(t.usuarioUid)!.nome}
            </span>
          ) : (
            <span className="text-destructive">Conta não encontrada</span>
          )
        ) : (
          <span className="text-subtle">Não vinculado</span>
        ),
    },
    { key: 'total', header: 'Total', render: (t) => stats.get(t.apelido || t.nome)?.total ?? 0 },
    { key: 'encerrados', header: 'Encerrados', render: (t) => stats.get(t.apelido || t.nome)?.encerrados ?? 0 },
    { key: 'pendentes', header: 'Pendentes', render: (t) => stats.get(t.apelido || t.nome)?.pendentes ?? 0 },
    {
      key: 'tempo',
      header: 'Tempo Médio',
      render: (t) => {
        const s = stats.get(t.apelido || t.nome);
        return s?.cntDias ? `${(s.somaDias / s.cntDias).toFixed(1)}d` : '—';
      },
    },
    {
      key: 'acoes',
      header: 'Ações',
      render: (t) =>
        souAdmin ? (
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); abrirEditar(t); }}>
            Editar
          </Button>
        ) : (
          <span className="text-subtle">—</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Total" value={carregando ? '—' : tecnicos.length} color="blue" />
        <KpiCard label="Mais Produtivo" value={carregando ? '—' : maisProdutivo} color="green" />
        <KpiCard label="Ativos" value={carregando ? '—' : tecnicos.filter((t) => t.status === 'Ativo').length} color="amber" />
        <KpiCard label="Pendentes (total)" value={carregando ? '—' : [...stats.values()].reduce((a, s) => a + s.pendentes, 0)} color="purple" />
      </div>

      {souAdmin && duplicatas.length > 0 && (
        <div className="flex flex-col gap-2 rounded-sm border border-warning bg-warning-bg p-3 text-sm">
          <div className="flex items-center gap-2 font-semibold text-warning">
            <AlertTriangle className="h-4 w-4" />
            {duplicatas.length} possível(is) duplicata(s) no cadastro — revisão manual necessária
          </div>
          <p className="text-xs text-muted-foreground">
            Cada nome abaixo tem mais de um documento na coleção <code>tecnicos</code> do Firestore. A V3 mostra só o mais
            recente na tela; os outros continuam intactos e visíveis aqui pra você decidir se são a mesma pessoa (e mesclar/
            excluir manualmente) ou pessoas diferentes com nome parecido. Nada é apagado automaticamente.
          </p>
          <ul className="flex flex-col gap-1">
            {duplicatas.map((d) => (
              <li key={d.identidade} className="font-mono-num text-xs text-foreground">
                {d.tecnicos[0].nome} — {d.tecnicos.length} documentos: {d.tecnicos.map((t) => t.id).join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      <FilterBar>
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, apelido…" className="w-56" />
        {souAdmin && (
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleVincular} disabled={vincular.isPending}>
              <Link2 className="h-3.5 w-3.5" /> {vincular.isPending ? 'Vinculando…' : 'Vincular Usuários'}
            </Button>
            <Button size="sm" onClick={abrirNovo}>
              <Plus className="h-3.5 w-3.5" /> Novo Técnico
            </Button>
          </div>
        )}
      </FilterBar>

      <DataTable columns={columns} rows={filtrados} rowKey={(t) => t.key} loading={carregando} emptyTitle="Nenhum técnico cadastrado" />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editKey ? 'Editar Técnico' : 'Novo Técnico'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo label="Nome completo *" htmlFor="tec-nome">
              <Input id="tec-nome" value={form.nome || ''} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            </Campo>
            <Campo label="Apelido" htmlFor="tec-apelido">
              <Input id="tec-apelido" value={form.apelido || ''} onChange={(e) => setForm((f) => ({ ...f, apelido: e.target.value }))} placeholder="Usado como chave nos chamados" />
            </Campo>
            <Campo label="Telefone" htmlFor="tec-telefone">
              <Input id="tec-telefone" value={form.telefone || ''} onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))} />
            </Campo>
            <Campo label="E-mail" htmlFor="tec-email">
              <Input id="tec-email" value={form.email || ''} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </Campo>
            <Campo label="Área" htmlFor="tec-area">
              <Input id="tec-area" value={form.area || ''} onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))} />
            </Campo>
            <Campo label="Cargo" htmlFor="tec-cargo">
              <Input id="tec-cargo" value={form.cargo || ''} onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))} />
            </Campo>
            <Campo label="Status" htmlFor="tec-status">
              <Select value={form.status || 'Ativo'} onValueChange={(v) => setForm((f) => ({ ...f, status: v as Tecnico['status'] }))}>
                <SelectTrigger id="tec-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Ativo">Ativo</SelectItem>
                  <SelectItem value="Inativo">Inativo</SelectItem>
                  <SelectItem value="Férias">Férias</SelectItem>
                  <SelectItem value="Afastado">Afastado</SelectItem>
                </SelectContent>
              </Select>
            </Campo>
            <Campo label="Admissão" htmlFor="tec-admissao">
              <Input id="tec-admissao" type="date" value={form.admissao || ''} onChange={(e) => setForm((f) => ({ ...f, admissao: e.target.value }))} />
            </Campo>
          </div>
          <Campo label="Usuário vinculado (login no sistema)" htmlFor="tec-usuario">
            <Select
              value={form.usuarioUid || SEM_VINCULO}
              onValueChange={(v) => setForm((f) => ({ ...f, usuarioUid: v === SEM_VINCULO ? null : v }))}
            >
              <SelectTrigger id="tec-usuario"><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_VINCULO}>Nenhum</SelectItem>
                {usuariosElegiveis.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.nome} ({u.login})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-subtle">
              Só contas com perfil Técnico e status Ativo aparecem aqui — é esse vínculo (não nome/e-mail) que faz a reatribuição administrativa e os relatórios de produtividade identificarem este técnico pelo UID da própria conta.
            </p>
          </Campo>
          <Campo label="Observações" htmlFor="tec-obs">
            <textarea
              id="tec-obs"
              value={form.obs || ''}
              onChange={(e) => setForm((f) => ({ ...f, obs: e.target.value }))}
              rows={2}
              className="rounded-sm border border-border bg-muted p-2.5 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </Campo>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={salvar.isPending}>{salvar.isPending ? 'Salvando…' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
