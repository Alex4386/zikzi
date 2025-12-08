import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Network, Loader2, Wifi } from 'lucide-react'
import { api } from '@/lib/api'
import { PageContainer } from '@/components/PageContainer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function IPAddresses() {
  const [showForm, setShowForm] = useState(false)
  const [ipAddress, setIpAddress] = useState('')
  const [description, setDescription] = useState('')
  const queryClient = useQueryClient()

  const { data: ips, isLoading } = useQuery({
    queryKey: ['ips'],
    queryFn: () => api.getIPs(),
  })

  const detectMutation = useMutation({
    mutationFn: () => api.detectIP(),
    onSuccess: (data) => {
      setIpAddress(data.ip_address)
    },
  })

  const addMutation = useMutation({
    mutationFn: () => api.registerIP(ipAddress, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ips'] })
      setShowForm(false)
      setIpAddress('')
      setDescription('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteIP(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ips'] })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    addMutation.mutate()
  }

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">IP Addresses</h1>
          <p className="text-muted-foreground mt-1">
            Register your IP addresses to automatically associate print jobs with your account
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add IP
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Register New IP Address</CardTitle>
            <CardDescription>Add an IP address to link print jobs to your account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ipAddress">IP Address</Label>
                <div className="flex gap-2">
                  <Input
                    id="ipAddress"
                    type="text"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    placeholder="192.168.1.100"
                    required
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => detectMutation.mutate()}
                    disabled={detectMutation.isPending}
                  >
                    <Wifi className="h-4 w-4 mr-2" />
                    {detectMutation.isPending ? 'Detecting...' : 'Detect My IP'}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Office Desktop, Home Laptop"
                />
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={addMutation.isPending}>
                  {addMutation.isPending ? 'Adding...' : 'Add IP Address'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false)
                    setIpAddress('')
                    setDescription('')
                  }}
                >
                  Cancel
                </Button>
              </div>

              {addMutation.error && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {addMutation.error instanceof Error ? addMutation.error.message : 'Failed to add IP'}
                  </AlertDescription>
                </Alert>
              )}
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : ips?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Network className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No IP addresses registered</p>
          <p className="text-sm mt-2">Add an IP to automatically link print jobs to your account</p>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>IP Address</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ips?.map((ip) => (
                <TableRow key={ip.id}>
                  <TableCell className="font-mono">{ip.ip_address}</TableCell>
                  <TableCell className="text-muted-foreground">{ip.description || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={ip.is_active ? 'success' : 'secondary'}>
                      {ip.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(ip.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm('Remove this IP address?')) {
                          deleteMutation.mutate(ip.id)
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </PageContainer>
  )
}
