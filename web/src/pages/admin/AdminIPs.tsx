import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Network, Plus, Pencil, Trash2, MapPin } from 'lucide-react'
import { api, IPRegistration, AdminUser } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { PageContainer } from '@/components/PageContainer'
import { JobsPagination } from '@/components/JobsPagination'
import { Note } from '@/components/Note'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type DialogMode = 'create' | 'edit' | 'delete' | null

export default function AdminIPs() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [dialogMode, setDialogMode] = useState<DialogMode>(null)
  const [selectedIP, setSelectedIP] = useState<IPRegistration | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Form states
  const [ipAddress, setIpAddress] = useState('')
  const [description, setDescription] = useState('')
  const [userId, setUserId] = useState('')
  const [isDetecting, setIsDetecting] = useState(false)

  const { data, isLoading, error: fetchError } = useQuery({
    queryKey: ['admin', 'ips', page],
    queryFn: () => api.getIPs(page, 20, { full: true }),
  })

  const { data: users } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.getAdminUsers(),
  })

  const createMutation = useMutation({
    mutationFn: () => api.registerIP(ipAddress, description, userId || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'ips'] })
      closeDialog()
    },
    onError: (err: Error) => setError(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: () => api.updateIP(selectedIP!.id, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'ips'] })
      closeDialog()
    },
    onError: (err: Error) => setError(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteIP(selectedIP!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'ips'] })
      closeDialog()
    },
    onError: (err: Error) => setError(err.message),
  })

  const detectIP = async () => {
    setIsDetecting(true)
    try {
      const result = await api.detectIP()
      setIpAddress(result.ip_address)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detect IP')
    } finally {
      setIsDetecting(false)
    }
  }

  const openCreate = () => {
    setIpAddress('')
    setDescription('')
    setUserId('')
    setError(null)
    setDialogMode('create')
  }

  const openEdit = (ip: IPRegistration) => {
    setSelectedIP(ip)
    setDescription(ip.description)
    setError(null)
    setDialogMode('edit')
  }

  const openDelete = (ip: IPRegistration) => {
    setSelectedIP(ip)
    setError(null)
    setDialogMode('delete')
  }

  const closeDialog = () => {
    setDialogMode(null)
    setSelectedIP(null)
    setError(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (dialogMode === 'create') {
      createMutation.mutate()
    } else if (dialogMode === 'edit') {
      updateMutation.mutate()
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('admin.ips.title')}</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t('admin.ips.addIp')}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : fetchError ? (
        <div className="text-center py-12 text-destructive">
          {t('admin.ips.failedToLoad')}
        </div>
      ) : data?.ips?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Network className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{t('admin.ips.noIps')}</p>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.ips.ipAddress')}</TableHead>
                <TableHead>{t('common.description')}</TableHead>
                <TableHead>{t('common.user')}</TableHead>
                <TableHead>{t('common.status')}</TableHead>
                <TableHead>{t('admin.ips.registeredAt')}</TableHead>
                <TableHead className="text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.ips?.map((ip) => (
                <TableRow key={ip.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Network className="h-4 w-4 text-muted-foreground" />
                      <code className="text-sm font-mono">{ip.ip_address}</code>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {ip.description || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    {ip.user ? (
                      <div>
                        <p className="font-medium text-sm">{ip.user.display_name}</p>
                        <p className="text-xs text-muted-foreground">@{ip.user.username}</p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ip.is_active ? 'default' : 'secondary'}>
                      {ip.is_active ? t('common.active') : t('common.inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(ip.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(ip)} title={t('admin.ips.editIp')}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openDelete(ip)} title={t('admin.ips.deleteIp')} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {data && (
        <JobsPagination
          page={page}
          pageSize={20}
          total={data.total}
          onPageChange={setPage}
        />
      )}

      {/* Create Dialog */}
      <Dialog open={dialogMode === 'create'} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.ips.addIp')}</DialogTitle>
            <DialogDescription>{t('admin.ips.addIpDescription')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ipAddress">{t('admin.ips.ipAddress')}</Label>
              <div className="flex gap-2">
                <Input
                  id="ipAddress"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  placeholder="192.168.1.100"
                  required
                  className="flex-1"
                />
                <Button type="button" variant="outline" onClick={detectIP} disabled={isDetecting}>
                  <MapPin className="h-4 w-4 mr-2" />
                  {isDetecting ? t('ipAddresses.add.detecting') : t('ipAddresses.add.detectMyIp')}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t('common.description')}</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('ipAddresses.labelPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="userId">{t('admin.ips.assignToUser')}</Label>
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('admin.ips.selectUser')} />
                </SelectTrigger>
                <SelectContent>
                  {users?.map((user: AdminUser) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.display_name} (@{user.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {error && (
              <Note variant="error">
                {error}
              </Note>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? t('common.adding') : t('common.add')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={dialogMode === 'edit'} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.ips.editIp')}</DialogTitle>
            <DialogDescription>
              {t('admin.ips.editIpDescription', { ip: selectedIP?.ip_address })}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editDescription">{t('common.description')}</Label>
              <Input
                id="editDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('ipAddresses.labelPlaceholder')}
              />
            </div>
            {error && (
              <Note variant="error">
                {error}
              </Note>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? t('common.saving') : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={dialogMode === 'delete'} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.ips.deleteIp')}</DialogTitle>
          </DialogHeader>
          <p className="py-4">
            {t('admin.ips.deleteConfirm', { ip: selectedIP?.ip_address })}
          </p>
          {error && (
            <Note variant="error">
              {error}
            </Note>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={isPending}>
              {isPending ? t('common.deleting') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
