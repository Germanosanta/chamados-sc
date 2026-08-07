import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, Lock, User, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { loginComUsuarioOuEmail, trocarSenha, LoginError } from '@/services/firebase/auth';
import { useSessionStore } from '@/store/session';
import logo from '@/assets/img/coa.jpeg';

const LEMBRAR_KEY = 'chm-lembrar-usuario';

/**
 * Mesmo fluxo real de login da V2 (doLogin): resolve login→e-mail,
 * autentica no Firebase Auth de verdade, checa status, e força troca de
 * senha obrigatória quando o perfil tem `precisaTrocarSenha`.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const setUsuario = useSessionStore((s) => s.setUsuario);

  const [step, setStep] = useState<'login' | 'trocar-senha'>('login');
  const [loginOuEmail, setLoginOuEmail] = useState(() => localStorage.getItem(LEMBRAR_KEY) || '');
  const [lembrar, setLembrar] = useState(() => !!localStorage.getItem(LEMBRAR_KEY));
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const { perfil } = await loginComUsuarioOuEmail(loginOuEmail.trim(), senha);
      if (lembrar) localStorage.setItem(LEMBRAR_KEY, loginOuEmail.trim());
      else localStorage.removeItem(LEMBRAR_KEY);
      if (perfil.precisaTrocarSenha) {
        setStep('trocar-senha');
        return;
      }
      setUsuario(perfil);
      navigate('/portal', { replace: true });
    } catch (err) {
      setErro(err instanceof LoginError ? err.message : 'Login ou senha inválidos.');
    } finally {
      setCarregando(false);
    }
  }

  async function handleTrocarSenha(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (novaSenha.length < 6) {
      setErro('A nova senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (novaSenha !== confirmSenha) {
      setErro('As senhas não coincidem.');
      return;
    }
    setCarregando(true);
    try {
      await trocarSenha(novaSenha);
      const { perfil } = await loginComUsuarioOuEmail(loginOuEmail.trim(), novaSenha);
      setUsuario(perfil);
      navigate('/portal', { replace: true });
    } catch {
      setErro('Não foi possível trocar a senha. Faça login novamente.');
      setStep('login');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Card className="w-full max-w-sm rounded-xl shadow-xl">
      <CardHeader className="items-center text-center">
        <img src={logo} alt="Santa Colomba" className="mb-2 h-auto w-full max-w-[220px] object-contain" />
        <CardTitle>Central de Chamados</CardTitle>
        <CardDescription>Santa Colomba Agropecuária — V3</CardDescription>
      </CardHeader>
      <CardContent>
        {step === 'login' ? (
          <form onSubmit={handleLogin} className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login">Usuário</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                <Input
                  id="login"
                  autoComplete="username"
                  value={loginOuEmail}
                  onChange={(e) => setLoginOuEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder="seu.usuario"
                  className="pl-8"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="senha">Senha</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                <Input
                  id="senha"
                  type={mostrarSenha ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  className="pl-8 pr-8"
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-subtle hover:text-foreground"
                >
                  {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={lembrar} onCheckedChange={(v) => setLembrar(v === true)} />
              Lembrar usuário
            </label>
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <Button type="submit" disabled={carregando} className="mt-1">
              {carregando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Entrar
            </Button>
            <button
              type="button"
              onClick={() => toast('Esqueceu a senha? Fale com o administrador do sistema.')}
              className="text-sm text-muted-foreground hover:text-primary"
            >
              Esqueci minha senha
            </button>
          </form>
        ) : (
          <form onSubmit={handleTrocarSenha} className="flex flex-col gap-3.5">
            <p className="text-sm text-muted-foreground">
              Sua conta exige a troca de senha antes de continuar.
            </p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nova-senha">Nova senha</Label>
              <Input id="nova-senha" type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} required autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmar-senha">Confirmar nova senha</Label>
              <Input
                id="confirmar-senha"
                type="password"
                value={confirmSenha}
                onChange={(e) => setConfirmSenha(e.target.value)}
                required
              />
            </div>
            {erro && <p className="text-sm text-destructive">{erro}</p>}
            <Button type="submit" disabled={carregando} className="mt-1">
              {carregando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Trocar senha e continuar
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
