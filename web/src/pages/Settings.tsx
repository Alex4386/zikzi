import { Printer, Download } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
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
      <h1 className="text-2xl font-bold mb-6">Printer Setup</h1>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Printer className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Connect Your Printer</CardTitle>
              <CardDescription>Add a RAW PostScript printer pointing to this server</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-1">RAW Socket Address</p>
            <code className="text-lg font-mono text-primary">
              socket://{printerHostname}:{rawPort}
            </code>
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-medium">Manual Setup Instructions:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Open your system's printer settings</li>
              <li>Add a new printer → TCP/IP or Socket printer</li>
              <li>Enter hostname: <code>{printerHostname}</code>, port: <code>{rawPort}</code></li>
              <li>Select "Generic PostScript Printer" or "Raw" as the driver</li>
              <li>Register your IP address in the "IP Addresses" tab</li>
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
              <CardTitle>Automatic Setup</CardTitle>
              <CardDescription>Download a script to automatically configure the printer</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={handleDownloadWindows} variant="outline" className="w-full justify-start">
            <Download className="h-4 w-4 mr-2" />
            Download for Windows (.bat)
          </Button>
          <Button onClick={handleDownloadMac} variant="outline" className="w-full justify-start">
            <Download className="h-4 w-4 mr-2" />
            Download for macOS (.command)
          </Button>
          <Button onClick={handleDownloadLinux} variant="outline" className="w-full justify-start">
            <Download className="h-4 w-4 mr-2" />
            Download for Linux (.sh)
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Windows: Right-click and "Run as administrator"<br />
            macOS/Linux: Run <code>chmod +x</code> then execute the script
          </p>
        </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
