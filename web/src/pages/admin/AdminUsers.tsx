import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, User, Plus, Trash2, Eye } from 'lucide-react'
import { api, AdminUser } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { PageContainer } from '@/components/PageContainer'
import { Note } from '@/components/Note'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

type DialogMode = 'create' | 'delete' | null

export default function AdminUsers() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [dialogMode, setDialogMode] = useState<DialogMode>(null)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Form states
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  const { data: users, isLoading, error: fetchError } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.getAdminUsers(),
  })

  const createMutation = useMutation({
    mutationFn: () => api.createUser({ username, email, password, display_name: displayName, is_admin: isAdmin }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      closeDialog()
    },
    onError: (err: Error) => setError(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteUser(selectedUser!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      closeDialog()
    },
    onError: (err: Error) => setError(err.message),
  })

  const openCreate = () => {
    setUsername('')
    setEmail('')
    setDisplayName('')
    setPassword('')
    setIsAdmin(false)
    setError(null)
    setDialogMode('create')
  }

  const openDelete = (user: AdminUser) => {
    setSelectedUser(user)
    setError(null)
    setDialogMode('delete')
  }

  const closeDialog = () => {
    setDialogMode(null)
    setSelectedUser(null)
    setError(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (dialogMode === 'create') {
      createMutation.mutate()
    }
  }

  const isPending = createMutation.isPending || deleteMutation.isPending

  return (
    <PageContainer>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t('admin.users.title')}</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t('admin.users.addUser')}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : fetchError ? (
        <div className="text-center py-12 text-destructive">
          {t('admin.users.failedToLoad')}
        </div>
      ) : users?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{t('admin.users.noUsers')}</p>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common.user')}</TableHead>
                <TableHead>{t('admin.users.email')}</TableHead>
                <TableHead>{t('common.role')}</TableHead>
                <TableHead>{t('admin.users.jobCount')}</TableHead>
                <TableHead>{t('admin.users.createdAt')}</TableHead>
                <TableHead className="text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Link to={`/admin/users/${user.id}`} className="flex items-center gap-2 hover:text-primary">
                      <div>
                        <p className="font-medium">{user.display_name}</p>
                        <p className="text-sm text-muted-foreground">@{user.username}</p>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{user.email}</TableCell>
                  <TableCell>
                    <Badge variant={user.is_admin ? 'default' : 'secondary'}>
                      {user.is_admin ? t('common.admin') : t('common.user')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{user.job_count}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(user.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" asChild title={t('admin.users.viewUser')}>
                        <Link to={`/admin/users/${user.id}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openDelete(user)} title={t('admin.users.deleteUser')} className="text-destructive hover:text-destructive">
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

      {/* Create Dialog */}
      <Dialog open={dialogMode === 'create'} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.users.addUser')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">{t('admin.users.username')}</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('admin.users.email')}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">{t('admin.users.displayName')}</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('admin.users.password')}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isAdmin"
                checked={isAdmin}
                onCheckedChange={(checked: boolean) => setIsAdmin(checked === true)}
              />
              <Label htmlFor="isAdmin" className="cursor-pointer">{t('admin.users.isAdmin')}</Label>
            </div>
            {error && (
              <Note variant="error">
                {error}
              </Note>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? t('common.saving') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={dialogMode === 'delete'} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.users.deleteUser')}</DialogTitle>
          </DialogHeader>
          <p className="py-4">
            {t('admin.users.deleteConfirm', { name: selectedUser?.display_name, username: selectedUser?.username })}
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
