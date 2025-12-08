import { Printer, Download } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PageContainer } from '@/components/PageContainer'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  generateWindowsScript,
  generateMacScript,
  generateLinuxScript,
  downloadScript,
} from '@/lib/printer-scripts'

interface Config {
  printer_external_hostname: string
  ipp_port: number
  raw_port: number
}

export default function Settings() {
  const { t } = useTranslation()
  const { data: config } = useQuery<Config>({
    queryKey: ['config'],
    queryFn: async () => {
      const res = await fetch('/api/v1/config')
      if (!res.ok) throw new Error('Failed to fetch config')
      return res.json()
    },
  })

  const printerHostname = config?.printer_external_hostname || window.location.hostname
  const rawPort = config?.raw_port || 9100

  const handleDownloadWindows = () => {
    const script = generateWindowsScript(printerHostname, rawPort)
    downloadScript(script, 'setup-zikzi-printer.bat')
  }

  const handleDownloadMac = () => {
    const script = generateMacScript(printerHostname, rawPort)
    downloadScript(script, 'setup-zikzi-printer.command')
  }

  const handleDownloadLinux = () => {
    const script = generateLinuxScript(printerHostname, rawPort)
    downloadScript(script, 'setup-zikzi-printer.sh')
  }

  return (
    <PageContainer>
      <h1 className="text-2xl font-bold mb-6">{t('settings.title')}</h1>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Printer className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>{t('settings.printer.connectTitle')}</CardTitle>
              <CardDescription>{t('settings.printer.connectDescription')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-1">{t('settings.printer.rawSocketAddress')}</p>
            <code className="text-lg font-mono text-primary">
              socket://{printerHostname}:{rawPort}
            </code>
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-medium">{t('settings.printer.manualSetup')}</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>{t('settings.printer.step1')}</li>
              <li>{t('settings.printer.step2')}</li>
              <li>{t('settings.printer.step3', { hostname: printerHostname, port: rawPort })}</li>
              <li>{t('settings.printer.step4')}</li>
              <li>{t('settings.printer.step5')}</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>{t('settings.printer.automaticSetup')}</CardTitle>
              <CardDescription>{t('settings.printer.automaticSetupDescription')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={handleDownloadWindows} variant="outline" className="w-full justify-start">
            <Download className="h-4 w-4 mr-2" />
            {t('settings.printer.downloadWindows')}
          </Button>
          <Button onClick={handleDownloadMac} variant="outline" className="w-full justify-start">
            <Download className="h-4 w-4 mr-2" />
            {t('settings.printer.downloadMac')}
          </Button>
          <Button onClick={handleDownloadLinux} variant="outline" className="w-full justify-start">
            <Download className="h-4 w-4 mr-2" />
            {t('settings.printer.downloadLinux')}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            {t('settings.printer.windowsNote')}<br />
            {t('settings.printer.macLinuxNote')}
          </p>
        </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
