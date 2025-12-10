import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Loader2, User, FileText, Network, Key, Pencil } from 'lucide-react'
import { api, AdminUser } from '@/lib/api'
import { formatDate, formatBytes } from '@/lib/utils'
import { statusIcons, statusVariants, JobStatus } from '@/lib/job-utils'
import { PageContainer } from '@/components/PageContainer'
import { JobsPagination } from '@/components/JobsPagination'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Note } from '@/components/Note'

export default function AdminUserDetail() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [jobsPage, setJobsPage] = useState(1)
  const [ipsPage, setIpsPage] = useState(1)
  const [tokensPage, setTokensPage] = useState(1)
  const [dialogMode, setDialogMode] = useState<'edit' | 'password' | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Form states
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  const { data: user, isLoading: userLoading, error: userError } = useQuery({
    queryKey: ['admin', 'user', id],
    queryFn: () => api.getAdminUser(id!),
    enabled: !!id,
  })

  const updateMutation = useMutation({
    mutationFn: () => api.updateAdminUser(id!, { username, email, display_name: displayName, is_admin: isAdmin }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'user', id] })
      closeDialog()
    },
    onError: (err: Error) => setError(err.message),
  })

  const passwordMutation = useMutation({
    mutationFn: () => api.changeUserPassword(id!, password),
    onSuccess: () => {
      closeDialog()
    },
    onError: (err: Error) => setError(err.message),
  })

  const openEdit = (user: AdminUser) => {
    setUsername(user.username)
    setEmail(user.email)
    setDisplayName(user.display_name)
    setIsAdmin(user.is_admin)
    setError(null)
    setDialogMode('edit')
  }

  const openPassword = () => {
    setPassword('')
    setError(null)
    setDialogMode('password')
  }

  const closeDialog = () => {
    setDialogMode(null)
    setError(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (dialogMode === 'edit') {
      updateMutation.mutate()
    } else if (dialogMode === 'password') {
      passwordMutation.mutate()
    }
  }

  const isPending = updateMutation.isPending || passwordMutation.isPending

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ['jobs', 'user', id, jobsPage],
    queryFn: () => api.getJobs(jobsPage, 20, undefined, { userId: id }),
    enabled: !!id,
  })

  const { data: ipsData, isLoading: ipsLoading } = useQuery({
    queryKey: ['ips', 'user', id, ipsPage],
    queryFn: () => api.getIPs(ipsPage, 20, { userId: id }),
    enabled: !!id,
  })

  const { data: tokensData, isLoading: tokensLoading } = useQuery({
    queryKey: ['tokens', 'user', id, tokensPage],
    queryFn: () => api.getTokens(tokensPage, 20, { userId: id }),
    enabled: !!id,
  })

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (userError || !user) {
    return (
      <PageContainer>
        <Button variant="ghost" onClick={() => navigate('/admin/users')} className="mb-6">
          <ArrowLeft className="h-5 w-5 mr-2" />
          {t('common.back')}
        </Button>
        <div className="text-center py-12 text-destructive">
          {t('admin.userDetail.notFound')}
        </div>
      </PageContainer>
    )
  }

  const getTokenStatusBadge = (token: { is_active: boolean; expires_at?: string }) => {
    if (!token.is_active) {
      return <Badge variant="secondary">{t('tokens.revoked')}</Badge>
    }
    if (token.expires_at && new Date(token.expires_at) < new Date()) {
      return <Badge variant="destructive">{t('tokens.expired')}</Badge>
    }
    return <Badge variant="success">{t('common.active')}</Badge>
  }

  return (
    <PageContainer>
      <Button variant="ghost" onClick={() => navigate('/admin/users')} className="mb-6">
        <ArrowLeft className="h-5 w-5 mr-2" />
        {t('admin.userDetail.backToUsers')}
      </Button>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-muted rounded-full">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">{user.display_name}</CardTitle>
              <p className="text-muted-foreground">@{user.username}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Badge variant={user.is_admin ? 'default' : 'secondary'}>
                {user.is_admin ? t('common.admin') : t('common.user')}
              </Badge>
              <Button variant="ghost" size="icon" onClick={() => openEdit(user)} title={t('admin.users.editUser')}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={openPassword} title={t('admin.users.changePassword')}>
                <Key className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">{t('admin.users.email')}</p>
              <p className="font-medium">{user.email}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('admin.users.createdAt')}</p>
              <p className="font-medium">{formatDate(user.created_at)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t('admin.users.jobCount')}</p>
              <p className="font-medium">{user.job_count}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="jobs" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="jobs" className="gap-2">
            <FileText className="h-4 w-4" />
            {t('admin.userDetail.tabs.jobs')}
            {jobsData && <span className="text-muted-foreground">({jobsData.total})</span>}
          </TabsTrigger>
          <TabsTrigger value="ips" className="gap-2">
            <Network className="h-4 w-4" />
            {t('admin.userDetail.tabs.ips')}
            {ipsData && <span className="text-muted-foreground">({ipsData.total})</span>}
          </TabsTrigger>
          <TabsTrigger value="tokens" className="gap-2">
            <Key className="h-4 w-4" />
            {t('admin.userDetail.tabs.tokens')}
            {tokensData && <span className="text-muted-foreground">({tokensData.total})</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="jobs">
          {jobsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : jobsData?.jobs?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('admin.userDetail.noJobs')}</p>
            </div>
          ) : (
            <>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('jobs.document')}</TableHead>
                      <TableHead>{t('common.size')}</TableHead>
                      <TableHead>{t('jobs.pages')}</TableHead>
                      <TableHead>{t('common.status')}</TableHead>
                      <TableHead>{t('common.date')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobsData?.jobs.map((job) => {
                      const StatusIcon = statusIcons[job.status as JobStatus]
                      return (
                        <TableRow key={job.id}>
                          <TableCell>
                            <Link to={`/jobs/${job.id}`} className="hover:text-primary">
                              <p className="font-medium">{job.document_name || t('jobs.untitled')}</p>
                              {job.app_name && (
                                <p className="text-sm text-muted-foreground">{job.app_name}</p>
                              )}
                            </Link>
                          </TableCell>
                          <TableCell className="text-sm">{formatBytes(job.file_size)}</TableCell>
                          <TableCell className="text-sm">{job.page_count || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={statusVariants[job.status as JobStatus]} className="gap-1">
                              <StatusIcon className={`h-3 w-3 ${job.status === 'processing' ? 'animate-spin' : ''}`} />
                              <span>{t(`jobs.status.${job.status}`)}</span>
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(job.created_at)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </Card>
              {jobsData && (
                <JobsPagination
                  page={jobsPage}
                  pageSize={20}
                  total={jobsData.total}
                  onPageChange={setJobsPage}
                />
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="ips">
          {ipsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : ipsData?.ips?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Network className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('admin.userDetail.noIps')}</p>
            </div>
          ) : (
            <>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('admin.ips.ipAddress')}</TableHead>
                      <TableHead>{t('common.description')}</TableHead>
                      <TableHead>{t('common.status')}</TableHead>
                      <TableHead>{t('admin.ips.registeredAt')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ipsData?.ips.map((ip) => (
                      <TableRow key={ip.id}>
                        <TableCell className="font-mono text-sm">{ip.ip_address}</TableCell>
                        <TableCell className="text-sm">{ip.description || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={ip.is_active ? 'success' : 'secondary'}>
                            {ip.is_active ? t('common.active') : t('common.inactive')}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(ip.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
              {ipsData && (
                <JobsPagination
                  page={ipsPage}
                  pageSize={20}
                  total={ipsData.total}
                  onPageChange={setIpsPage}
                />
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="tokens">
          {tokensLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : tokensData?.tokens?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>{t('admin.userDetail.noTokens')}</p>
            </div>
          ) : (
            <>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('common.name')}</TableHead>
                      <TableHead>{t('common.status')}</TableHead>
                      <TableHead>{t('tokens.lastUsed')}</TableHead>
                      <TableHead>{t('tokens.expires')}</TableHead>
                      <TableHead>{t('common.added')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tokensData?.tokens.map((token) => (
                      <TableRow key={token.id}>
                        <TableCell className="font-medium">{token.name}</TableCell>
                        <TableCell>{getTokenStatusBadge(token)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {token.last_used_at ? formatDate(token.last_used_at) : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {token.expires_at ? formatDate(token.expires_at) : t('tokens.never')}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(token.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
              {tokensData && (
                <JobsPagination
                  page={tokensPage}
                  pageSize={20}
                  total={tokensData.total}
                  onPageChange={setTokensPage}
                />
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={dialogMode === 'edit'} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.users.editUser')}</DialogTitle>
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
                {isPending ? t('common.saving') : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={dialogMode === 'password'} onOpenChange={() => closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.users.changePasswordFor', { name: user.display_name })}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t('admin.users.newPassword')}</Label>
              <Input
                id="newPassword"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">{t('profile.passwordMinLength')}</p>
            </div>
            {error && (
              <Note variant="error">
                {error}
              </Note>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? t('common.saving') : t('admin.users.changePassword')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
