import { useState } from 'react'
import { Printer, Download, AlertTriangle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PageContainer } from '@/components/PageContainer'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  generateWindowsScript,
  downloadScript,
  PRINTER_DRIVERS,
} from '@/lib/printer-scripts'

interface Config {
  printer_external_hostname: string
  ipp_port: number
  raw_port: number
  printer_insecure: boolean
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
  const [selectedDriver, setSelectedDriver] = useState(PRINTER_DRIVERS[0].id)

  const handleDownloadWindows = () => {
    const driver = PRINTER_DRIVERS.find(d => d.id === selectedDriver) || PRINTER_DRIVERS[0]
    const script = generateWindowsScript(printerHostname, rawPort, driver)
    downloadScript(script, 'setup-zikzi-printer.bat')
  }

  return (
    <PageContainer>
      <h1 className="text-2xl font-bold mb-6">{t('settings.title')}</h1>

      {config?.printer_insecure && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-destructive">{t('settings.printer.insecureWarningTitle')}</p>
            <p className="text-sm text-destructive/80 mt-1">{t('settings.printer.insecureWarningDescription')}</p>
          </div>
        </div>
      )}

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
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="driver-select">{t('settings.printer.selectDriver')}</Label>
            <Select value={selectedDriver} onValueChange={setSelectedDriver}>
              <SelectTrigger id="driver-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRINTER_DRIVERS.map((driver) => (
                  <SelectItem key={driver.id} value={driver.id}>
                    {driver.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleDownloadWindows} variant="outline" className="w-full justify-start">
            <Download className="h-4 w-4 mr-2" />
            {t('settings.printer.downloadWindows')}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t('settings.printer.windowsNote')}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('settings.printer.macLinuxNote')}
          </p>
        </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
