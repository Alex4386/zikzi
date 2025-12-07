import { Printer } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useQuery } from '@tanstack/react-query'

interface Config {
  printer_external_hostname: string
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
  const printerUrl = `${printerHostname}:9100`

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Printer Setup</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Printer className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Connect Your Printer</CardTitle>
              <CardDescription>Add a network printer pointing to this server</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-1">Printer Address</p>
            <code className="text-lg font-mono text-primary">
              {printerUrl}
            </code>
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-medium">Setup Instructions:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Open your system's printer settings</li>
              <li>Add a new printer → Network printer</li>
              <li>Enter the address above</li>
              <li>Select "Generic PostScript Printer" as the driver</li>
              <li>Register your IP address in the "IP Addresses" tab</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
