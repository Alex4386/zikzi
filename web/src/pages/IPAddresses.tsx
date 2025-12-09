import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Network, Loader2, Wifi, Pencil } from 'lucide-react'
import { api, IPRegistration } from '@/lib/api'
import { PageContainer } from '@/components/PageContainer'
import { Note } from '@/components/Note'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function IPAddresses() {
  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)
  const [ipAddress, setIpAddress] = useState('')
  const [description, setDescription] = useState('')
  const [editingIp, setEditingIp] = useState<IPRegistration | null>(null)
  const [editDescription, setEditDescription] = useState('')
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

  const updateMutation = useMutation({
    mutationFn: ({ id, description }: { id: string; description: string }) =>
      api.updateIP(id, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ips'] })
      setEditingIp(null)
      setEditDescription('')
    },
  })

  const handleEdit = (ip: IPRegistration) => {
    setEditingIp(ip)
    setEditDescription(ip.description || '')
  }

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingIp) {
      updateMutation.mutate({ id: editingIp.id, description: editDescription })
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    addMutation.mutate()
  }

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('ipAddresses.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('ipAddresses.description')}
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('ipAddresses.addIp')}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('ipAddresses.add.title')}</CardTitle>
            <CardDescription>{t('ipAddresses.add.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ipAddress">{t('ipAddresses.ipAddress')}</Label>
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
                    {detectMutation.isPending ? t('ipAddresses.add.detecting') : t('ipAddresses.add.detectMyIp')}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t('common.description')} ({t('common.description').toLowerCase()})</Label>
                <Input
                  id="description"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('ipAddresses.labelPlaceholder')}
                />
              </div>

              <div className="flex gap-3">
                <Button type="submit" disabled={addMutation.isPending}>
                  {addMutation.isPending ? t('common.adding') : t('ipAddresses.add.addIpAddress')}
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
                  {t('common.cancel')}
                </Button>
              </div>

              {addMutation.error && (
                <Note variant="error">
                  {addMutation.error instanceof Error ? addMutation.error.message : t('common.failedToAdd')}
                </Note>
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
          <p>{t('ipAddresses.noAddresses')}</p>
          <p className="text-sm mt-2">{t('ipAddresses.noAddressesHint')}</p>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('ipAddresses.ipAddress')}</TableHead>
                <TableHead>{t('common.description')}</TableHead>
                <TableHead>{t('common.status')}</TableHead>
                <TableHead>{t('common.added')}</TableHead>
                <TableHead className="text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ips?.map((ip) => (
                <TableRow key={ip.id}>
                  <TableCell className="font-mono">{ip.ip_address}</TableCell>
                  <TableCell className="text-muted-foreground">{ip.description || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={ip.is_active ? 'success' : 'secondary'}>
                      {ip.is_active ? t('common.active') : t('common.inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(ip.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(ip)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(t('ipAddresses.delete.confirm'))) {
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

      {/* Edit IP Dialog */}
      <Dialog open={!!editingIp} onOpenChange={(open) => !open && setEditingIp(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('ipAddresses.edit.title')}</DialogTitle>
            <DialogDescription>
              {t('ipAddresses.edit.description', { ip: editingIp?.ip_address })}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editDescription">{t('common.description')}</Label>
                <Input
                  id="editDescription"
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder={t('ipAddresses.labelPlaceholder')}
                />
              </div>
              {updateMutation.error && (
                <Note variant="error">
                  {updateMutation.error instanceof Error ? updateMutation.error.message : t('common.failedToSave')}
                </Note>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingIp(null)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? t('common.saving') : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
