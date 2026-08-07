import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Plus } from 'lucide-react';
import { KpiCard } from '@/components/shared/KpiCard';
import { FilterBar } from '@/components/shared/FilterBar';
import { DataTable, type DataTableColumn } from '@/components/shared/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Campo } from '@/components/shared/FormField';
import { useUsuariosCadastro, useUsuariosDuplicados, useSalvarUsuario, useAlterarStatusUsuario, SalvarUsuarioError } from '@/hooks/useUsuarios';
import { enviarResetSenha } from '@/services/firebase/auth';
import { useSessionStore } from '@/store/session';
import { ALL_PERMS, PERFIL_LABEL, PERFIL_PERMS, type Perfil, type Permissao } from '@/types/permissoes';
import type { Usuario } from '@/types/usuario';

/** Cadastro de Usuários — portado de renderUsuarios()/salvarUsuario()
 * (usuarios/index.js): criação de conta real no Firebase Auth (app
 * secundário, ver services/firebase/auth.ts), grade de permissões
 * granulares com preset por perfil, reset de senha por e-mail. */
export function UsuariosPage() {
  // Cadastro: lista crua (1 linha por documento real, só sem os docs
  // "migrado") — não a versão deduplicada por identidade usada no resto
  // da V3. Mesmo raciocínio de TecnicosPage (ver useUsuariosCadastro).
  const { data: usuarios, carregando } = useUsuariosCadastro();
  const duplicatas = useUsuariosDuplicados();
  const usuarioLogado = useSessionStore((s) => s.usuario);
  const souAdmin = usuarioLogado?.perfil === 'admin';
  const salvar = useSalvarUsuario();
  const alterarStatus = useAlterarStatusUsuario();

  const [busca, setBusca] = useState('');
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [nome, setNome] = useState('');
  const [login, setLogin] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [cargo, setCargo] = useState('');
  const [perfil, setPerfil] = useState<Perfil>('tecnico');
  const [status, setStatus] = useState('Ativo');
  const [perms, setPerms] = useState<Permissao[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) => u.nome.toLowerCase().includes(q) || u.login.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [usuarios, busca]);

  function abrirNovo() {
    setEditando(null);
    setNome('');
    setLogin('');
    setEmail('');
    setSenha('');
    setCargo('');
    setPerfil('tecnico');
    setStatus('Ativo');
    setPerms(PERFIL_PERMS.tecnico);
    setErro(null);
    setOpen(true);
  }

  function abrirEditar(u: Usuario) {
    setEditando(u);
    setNome(u.nome);
    setLogin(u.login);
    setEmail(u.email);
    setSenha('');
    setCargo('');
    setPerfil(u.perfil);
    setStatus(u.status);
    setPerms(u.perms?.length ? u.perms : PERFIL_PERMS[u.perfil]);
    setErro(null);
    setOpen(true);
  }

  function aplicarPerfilPadrao(p: Perfil) {
    setPerfil(p);
    setPerms(PERFIL_PERMS[p]);
  }

  function togglePerm(p: Permissao) {
    setPerms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function handleSalvar() {
    setErro(null);
    try {
      await salvar.mutateAsync({
        id: editando?.id || null,
        nome,
        login,
        email,
        senha,
        cargo,
        perfil,
        status,
        perms,
        usuariosAtuais: usuarios,
      });
      toast(editando ? 'Usuário atualizado!' : 'Usuário cadastrado com sucesso!');
      setOpen(false);
    } catch (e) {
      setErro(e instanceof SalvarUsuarioError ? e.message : 'Não foi possível salvar o usuário.');
    }
  }

  async function handleResetSenha() {
    if (!editando?.email) return;
    try {
      await enviarResetSenha(editando.email);
      toast(`Link de redefinição enviado para ${editando.email}`);
    } catch {
      toast.error('Falha ao enviar e-mail de redefinição.');
    }
  }

  async function handleToggleStatus(u: Usuario) {
    if (u.id === usuarioLogado?.id) {
      toast.error('Você não pode desativar a própria conta.');
      return;
    }
    try {
      await alterarStatus.mutateAsync({ usuario: u, status: u.status === 'Ativo' ? 'Inativo' : 'Ativo' });
    } catch {
      toast.error('Não foi possível alterar o status.');
    }
  }

  const columns: DataTableColumn<Usuario>[] = [
    { key: 'nome', header: 'Nome', render: (u) => <span className="font-medium text-foreground">{u.nome}</span> },
    { key: 'login', header: 'Login', render: (u) => <span className="font-mono-num text-sm">{u.login}</span> },
    { key: 'perfil', header: 'Perfil', render: (u) => <Badge variant="graos">{PERFIL_LABEL[u.perfil]}</Badge> },
    { key: 'email', header: 'E-mail', render: (u) => u.email },
    { key: 'status', header: 'Status', render: (u) => <Badge variant={u.status === 'Ativo' ? 'green' : 'neutral'}>{u.status}</Badge> },
    {
      key: 'acoes',
      header: 'Ações',
      render: (u) =>
        souAdmin ? (
          <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" onClick={() => abrirEditar(u)}>Editar</Button>
            <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(u)}>{u.status === 'Ativo' ? 'Desativar' : 'Ativar'}</Button>
          </div>
        ) : (
          <span className="text-subtle">—</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Total" value={carregando ? '—' : usuarios.length} color="blue" />
        <KpiCard label="Ativos" value={carregando ? '—' : usuarios.filter((u) => u.status === 'Ativo').length} color="green" />
        <KpiCard label="Administradores" value={carregando ? '—' : usuarios.filter((u) => u.perfil === 'admin').length} color="purple" />
        <KpiCard label="Inativos" value={carregando ? '—' : usuarios.filter((u) => u.status !== 'Ativo').length} color="red" />
      </div>

      {souAdmin && duplicatas.length > 0 && (
        <div className="flex flex-col gap-2 rounded-sm border border-warning bg-warning-bg p-3 text-sm">
          <div className="flex items-center gap-2 font-semibold text-warning">
            <AlertTriangle className="h-4 w-4" />
            {duplicatas.length} possível(is) duplicata(s) no cadastro — revisão manual necessária
          </div>
          <p className="text-xs text-muted-foreground">
            Cada e-mail abaixo tem mais de um documento na coleção <code>usuarios</code> do Firestore que não é um
            "doc sombra" de migração (<code>migrado: true</code> já é filtrado à parte). A V3 mostra só um deles nas
            outras telas; os dois continuam intactos e visíveis aqui pra você decidir se são a mesma conta duplicada
            (mesclar/desativar manualmente) ou contas diferentes com e-mail coincidente. Nada é apagado automaticamente.
          </p>
          <ul className="flex flex-col gap-1">
            {duplicatas.map((d) => (
              <li key={d.identidade} className="font-mono-num text-xs text-foreground">
                {d.usuarios[0].email || d.usuarios[0].login} — {d.usuarios.length} documentos: {d.usuarios.map((u) => u.id).join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      <FilterBar>
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, login, e-mail…" className="w-64" />
        {souAdmin && (
          <Button className="ml-auto" size="sm" onClick={abrirNovo}>
            <Plus className="h-3.5 w-3.5" /> Novo Usuário
          </Button>
        )}
      </FilterBar>

      <DataTable columns={columns} rows={filtrados} rowKey={(u) => u.id} loading={carregando} emptyTitle="Nenhum usuário cadastrado" />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[65vh] flex-col gap-3.5 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="Nome *" htmlFor="user-nome">
                <Input id="user-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
              </Campo>
              <Campo label="Login *" htmlFor="user-login">
                <Input id="user-login" value={login} onChange={(e) => setLogin(e.target.value)} />
              </Campo>
              <Campo label="E-mail *" htmlFor="user-email">
                <Input id="user-email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!editando} />
              </Campo>
              {!editando ? (
                <Campo label="Senha * (mín. 6)" htmlFor="user-senha">
                  <Input id="user-senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
                </Campo>
              ) : (
                <Campo label="Senha">
                  <Button variant="ghost" size="sm" onClick={handleResetSenha}>Enviar link de redefinição</Button>
                </Campo>
              )}
              <Campo label="Cargo" htmlFor="user-cargo">
                <Input id="user-cargo" value={cargo} onChange={(e) => setCargo(e.target.value)} />
              </Campo>
              <Campo label="Perfil de acesso" htmlFor="user-perfil">
                <Select value={perfil} onValueChange={(v) => aplicarPerfilPadrao(v as Perfil)}>
                  <SelectTrigger id="user-perfil"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PERFIL_LABEL) as Perfil[]).map((p) => (
                      <SelectItem key={p} value={p}>{PERFIL_LABEL[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>
              <Campo label="Status" htmlFor="user-status">
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="user-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ativo">Ativo</SelectItem>
                    <SelectItem value="Inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </Campo>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <Label>Permissões granulares</Label>
                <button onClick={() => setPerms(PERFIL_PERMS[perfil])} className="text-xs font-semibold text-primary hover:underline">
                  Aplicar perfil padrão
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5 rounded-sm border border-border bg-muted p-2.5 sm:grid-cols-3">
                {(Object.keys(ALL_PERMS) as Permissao[]).map((p) => (
                  <label key={p} className="flex items-center gap-1.5 text-sm text-foreground">
                    <Checkbox checked={perms.includes(p)} onCheckedChange={() => togglePerm(p)} />
                    {ALL_PERMS[p]}
                  </label>
                ))}
              </div>
            </div>

            {erro && <p className="text-sm text-destructive">⛔ {erro}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={salvar.isPending}>{salvar.isPending ? 'Salvando…' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
