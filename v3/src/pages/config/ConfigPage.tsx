import { toast } from 'sonner';
import { Bell, Info, Moon, Sun, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useThemeStore } from '@/store/theme';
import { useChamados } from '@/hooks/useChamados';
import { useCadastroEquipamentos } from '@/hooks/useEquipamentos';
import { downloadCSV } from '@/utils/csv';

/**
 * Configurações — portado de renderConfig() (config/index.js), adaptado
 * à arquitetura da V3 (sem cache local separado pra sincronizar/limpar,
 * já que a V3 lê o Firestore em tempo real direto — ver Pendências no
 * relatório: fila de sync offline com paridade total ainda não portada).
 */
export function ConfigPage() {
  const { theme, toggle } = useThemeStore();
  const { data: chamados } = useChamados();
  const { data: equipamentos } = useCadastroEquipamentos();

  async function ativarNotificacoes() {
    if (!('Notification' in window)) {
      toast.error('Este navegador não suporta notificações.');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') toast('Notificações ativadas!');
    else toast('Permissão de notificação não concedida.');
  }

  function exportarChamadosCSV() {
    downloadCSV('chamados_santa_colomba.csv', [
      ['Número', 'Título', 'Cultura', 'Responsável', 'Data', 'Status', 'Sistema'],
      ...chamados.map((c) => [c.num, c.titulo, c.cultura, c.resp, c.data, c.status, c.bucket]),
    ]);
  }

  return (
    <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">{theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />} Aparência</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Tema {theme === 'dark' ? 'escuro' : 'claro'}</span>
          <Switch checked={theme === 'dark'} onCheckedChange={toggle} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sistema</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
          <div className="flex justify-between"><span>Chamados</span><span className="font-mono-num font-semibold text-foreground">{chamados.length}</span></div>
          <div className="flex justify-between"><span>Equipamentos cadastrados</span><span className="font-mono-num font-semibold text-foreground">{equipamentos.length}</span></div>
          <div className="flex justify-between"><span>Armazenamento</span><span className="font-semibold text-foreground">Firestore (tempo real)</span></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4" /> Notificações Push</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Permissão atual: <b className="text-foreground">{'Notification' in window ? Notification.permission : 'indisponível'}</b>
          </p>
          <Button size="sm" variant="ghost" onClick={ativarNotificacoes} className="self-start">Ativar notificações</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Download className="h-4 w-4" /> Dados</CardTitle>
        </CardHeader>
        <CardContent>
          <Button size="sm" variant="ghost" onClick={exportarChamadosCSV}>Exportar chamados (CSV)</Button>
        </CardContent>
      </Card>

      <Card className="sm:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Info className="h-4 w-4" /> Sobre</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Central de Chamados Enterprise V3 · Santa Colomba Agropecuária · React 19 + TypeScript + Firebase
        </CardContent>
      </Card>
    </div>
  );
}
