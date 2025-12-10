import { useState, useEffect } from 'react'
import { Printer, Download, Cable, Wifi, Shield, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { PageContainer } from '@/components/PageContainer'
import { Note } from '@/components/Note'
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
import { Switch } from '@/components/ui/switch'
import { TabsContent, TabsList } from '@/components/ui/tabs'
import SmartTabs from '@/components/smart-tabs'
import IconTabsTrigger from '@/components/icon-tabs-trigger'
import {
  generateWindowsScript,
  downloadScript,
  PRINTER_DRIVERS,
} from '@/lib/printer-scripts'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'

interface IPPAuth {
  allow_ip: boolean
  allow_login: boolean
}

interface Config {
  printer_external_hostname: string
  ipp_port: number
  ipp_enabled: boolean
  ipp_auth: IPPAuth
  raw_port: number
  printer_insecure: boolean
}

function isMacOS(): boolean {
  // Check userAgentData first (modern API), fall back to userAgent
  const userAgentData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
  if (userAgentData?.platform) {
    return userAgentData.platform.toUpperCase().indexOf('MAC') >= 0
  }
  return navigator.userAgent.toUpperCase().indexOf('MAC') >= 0
}

export default function Settings() {
  const { t } = useTranslation()
  const { user, refreshUser } = useAuth()
  const [showMacAlert, setShowMacAlert] = useState(false)
  const [allowIPPPassword, setAllowIPPPassword] = useState(user?.allow_ipp_password ?? true)

  const { data: config } = useQuery<Config>({
    queryKey: ['config'],
    queryFn: async () => {
      const res = await fetch('/api/v1/config')
      if (!res.ok) throw new Error('Failed to fetch config')
      return res.json()
    },
  })

  const { data: ips } = useQuery({
    queryKey: ['ips'],
    queryFn: () => api.getIPs(),
  })

  const hasRegisteredIPs = (ips?.length ?? 0) > 0

  // Update local state when user changes
  useEffect(() => {
    if (user) {
      setAllowIPPPassword(user.allow_ipp_password ?? true)
    }
  }, [user])

  useEffect(() => {
    setShowMacAlert(isMacOS())
  }, [])

  const ippSettingsMutation = useMutation({
    mutationFn: (allow: boolean) => api.updateIPPSettings(allow),
    onSuccess: () => {
      refreshUser?.()
    },
  })

  const handleIPPPasswordToggle = (checked: boolean) => {
    setAllowIPPPassword(checked)
    ippSettingsMutation.mutate(checked)
  }

  const printerHostname = config?.printer_external_hostname || window.location.hostname
  const rawPort = config?.raw_port || 9100
  const ippPort = config?.ipp_port || 631
  const [selectedDriver, setSelectedDriver] = useState(PRINTER_DRIVERS[0].id)

  const handleDownloadWindows = () => {
    const driver = PRINTER_DRIVERS.find(d => d.id === selectedDriver) || PRINTER_DRIVERS[0]
    const script = generateWindowsScript(printerHostname, rawPort, driver)
    downloadScript(script, 'setup-zikzi-printer.bat')
  }

  const ippUrl = `ipp://${printerHostname}${ippPort !== 631 ? `:${ippPort}` : ''}/ipp/print`

  return (
    <PageContainer>
      <h1 className="text-2xl font-bold mb-6">{t('settings.title')}</h1>

      {config?.printer_insecure && (
        <Note variant="warning" title={t('settings.printer.insecureWarningTitle')} className="mb-6">
          {t('settings.printer.insecureWarningDescription')}
        </Note>
      )}

      {showMacAlert && config?.ipp_enabled && (
        <Note variant="info" title={t('settings.printer.macOSRecommendation')} className="mb-6">
          {t('settings.printer.macOSRecommendationDescription')}
        </Note>
      )}

      <SmartTabs defaultValue="raw">
        <TabsList>
          <IconTabsTrigger value="raw" icon={Cable}>
            {t('settings.printer.rawTab')}
          </IconTabsTrigger>
          {config?.ipp_enabled && (
            <IconTabsTrigger value="ipp" icon={Wifi}>
              {t('settings.printer.ippTab')}
            </IconTabsTrigger>
          )}
        </TabsList>

        {/* RAW Socket Tab */}
        <TabsContent value="raw">
          {!hasRegisteredIPs && (
            <Note variant="warning" title={t('settings.printer.noIpRegistered')} className="mb-6">
              <p>{t('settings.printer.noIpRegisteredHint')}</p>
              <Link to="/ips" className="inline-flex items-center text-sm font-medium text-primary hover:underline mt-2">
                {t('settings.printer.registerIpLink')}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Note>
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
                    {printerHostname}:{rawPort}
                  </code>
                </div>

                <div className="space-y-2 text-sm">
                  <p className="font-medium">{t('settings.printer.manualSetup')}</p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>{t('settings.printer.step1')}</li>
                    <li>{t('settings.printer.step2')}</li>
                    <li>{t('settings.printer.step3', { hostname: `${printerHostname}:${rawPort}` })}</li>
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
        </TabsContent>

        {/* IPP Tab */}
        {config?.ipp_enabled && (
          <TabsContent value="ipp">
            <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Wifi className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>{t('settings.printer.ippConnectTitle')}</CardTitle>
                      <CardDescription>{t('settings.printer.ippConnectDescription')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-muted rounded-lg p-4">
                    <p className="text-sm text-muted-foreground mb-1">{t('settings.printer.ippAddress')}</p>
                    <code className="text-lg font-mono text-primary break-all">
                      {ippUrl}
                    </code>
                  </div>

                  <div className="space-y-2 text-sm">
                    <p className="font-medium">{t('settings.printer.ippManualSetup')}</p>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      <li>{t('settings.printer.ippStep1')}</li>
                      <li>{t('settings.printer.ippStep2')}</li>
                      <li>{t('settings.printer.ippStep3', { url: ippUrl })}</li>
                      <li>{t('settings.printer.ippStep4')}</li>
                    </ol>
                  </div>

                  {config.ipp_auth.allow_login && (
                    <div className="border-t pt-4 mt-4">
                      <p className="text-sm font-medium mb-3">{t('settings.printer.ippCredentials')}</p>
                      <p className="text-xs text-muted-foreground mb-3">{t('settings.printer.ippCredentialsDescription')}</p>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-2 bg-muted rounded">
                          <span className="text-sm text-muted-foreground">{t('settings.printer.ippUsername')}</span>
                          <code className="font-mono text-sm text-primary">{user?.username}</code>
                        </div>
                        <div className="flex items-center justify-between p-2 bg-muted rounded">
                          <span className="text-sm text-muted-foreground">{t('settings.printer.ippPassword')}</span>
                          <span className="text-xs text-muted-foreground">
                            {allowIPPPassword
                              ? t('settings.printer.ippPasswordHint')
                              : t('settings.printer.ippPasswordHintTokenOnly')}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>{t('settings.printer.ippAuthTitle')}</CardTitle>
                      <CardDescription>{t('settings.printer.ippAuthDescription')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{t('settings.printer.ippAuthIP')}</p>
                        <p className="text-xs text-muted-foreground">{t('settings.printer.ippAuthIPDescription')}</p>
                      </div>
                      <span className={`text-sm font-medium ${config.ipp_auth.allow_ip ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {config.ipp_auth.allow_ip ? t('common.active') : t('common.inactive')}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{t('settings.printer.ippAuthPassword')}</p>
                        <p className="text-xs text-muted-foreground">{t('settings.printer.ippAuthPasswordDescription')}</p>
                      </div>
                      <span className={`text-sm font-medium ${config.ipp_auth.allow_login ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {config.ipp_auth.allow_login ? t('common.active') : t('common.inactive')}
                      </span>
                    </div>
                  </div>

                  {config.ipp_auth.allow_login && (
                    <>
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="space-y-0.5">
                          <Label htmlFor="allow-ipp-password" className="font-medium">
                            {t('settings.printer.allowIPPPassword')}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {t('settings.printer.allowIPPPasswordDescription')}
                          </p>
                        </div>
                        <Switch
                          id="allow-ipp-password"
                          checked={allowIPPPassword}
                          onCheckedChange={handleIPPPasswordToggle}
                          disabled={ippSettingsMutation.isPending}
                        />
                      </div>

                      {!allowIPPPassword && (
                        <Note variant="info">
                          {t('settings.printer.ippPasswordDisabledHint')}
                        </Note>
                      )}

                      {allowIPPPassword && (
                        <Note variant="info">
                          {t('settings.printer.ippAuthPasswordHint')}
                        </Note>
                      )}
                    </>
                  )}

                  {!config.ipp_auth.allow_ip && !config.ipp_auth.allow_login && (
                    <Note variant="warning">
                      {t('settings.printer.ippAuthNoneWarning')}
                    </Note>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </SmartTabs>
    </PageContainer>
  )
}
