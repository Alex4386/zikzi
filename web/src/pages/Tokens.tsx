import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Key, Loader2, Ban, Copy, Check } from 'lucide-react'
import { api, IPPToken, CreateIPPTokenResponse } from '@/lib/api'
import { PageContainer } from '@/components/PageContainer'
import { Note } from '@/components/Note'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
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

type DialogMode = 'create' | 'created' | null

export default function Tokens() {
  const { t } = useTranslation()
  const [dialogMode, setDialogMode] = useState<DialogMode>(null)
  const [tokenName, setTokenName] = useState('')
  const [expireDays, setExpireDays] = useState<string>('')
  const [newToken, setNewToken] = useState<CreateIPPTokenResponse | null>(null)
  const [copied, setCopied] = useState(false)
  const queryClient = useQueryClient()

  const { data: tokens, isLoading } = useQuery({
    queryKey: ['tokens'],
    queryFn: () => api.getTokens(),
  })

  const createMutation = useMutation({
    mutationFn: () => api.createToken(tokenName, expireDays ? parseInt(expireDays) : undefined),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tokens'] })
      setTokenName('')
      setExpireDays('')
      setNewToken(data)
      setDialogMode('created')
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.revokeToken(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tokens'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteToken(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tokens'] })
    },
  })

  const openCreate = () => {
    setTokenName('')
    setExpireDays('')
    setDialogMode('create')
  }

  const closeDialog = () => {
    setDialogMode(null)
    setNewToken(null)
    setTokenName('')
    setExpireDays('')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate()
  }

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getStatusBadge = (token: IPPToken) => {
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('tokens.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('tokens.description')}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t('tokens.createToken')}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : tokens?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>{t('tokens.noTokens')}</p>
          <p className="text-sm mt-2">{t('tokens.noTokensHint')}</p>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common.name')}</TableHead>
                <TableHead>{t('common.status')}</TableHead>
                <TableHead>{t('tokens.lastUsed')}</TableHead>
                <TableHead>{t('tokens.expires')}</TableHead>
                <TableHead>{t('common.added')}</TableHead>
                <TableHead className="text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens?.map((token) => (
                <TableRow key={token.id}>
                  <TableCell className="font-medium">{token.name}</TableCell>
                  <TableCell>{getStatusBadge(token)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {token.last_used_at ? (
                      <span title={token.last_used_ip || ''}>
                        {new Date(token.last_used_at).toLocaleDateString()}
                      </span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {token.expires_at ? new Date(token.expires_at).toLocaleDateString() : t('tokens.never')}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(token.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {token.is_active && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(t('tokens.revoke.confirm'))) {
                            revokeMutation.mutate(token.id)
                          }
                        }}
                        disabled={revokeMutation.isPending}
                        title={t('tokens.revoke.title')}
                      >
                        <Ban className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(t('tokens.delete.confirm'))) {
                          deleteMutation.mutate(token.id)
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      title={t('common.delete')}
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

      {/* Create Token Dialog */}
      <Dialog open={dialogMode === 'create'} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('tokens.create.title')}</DialogTitle>
            <DialogDescription>{t('tokens.create.description')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tokenName">{t('tokens.tokenName')}</Label>
              <Input
                id="tokenName"
                type="text"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder={t('tokens.tokenNamePlaceholder')}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expireDays">{t('tokens.expireDays')}</Label>
              <Input
                id="expireDays"
                type="number"
                min="0"
                value={expireDays}
                onChange={(e) => setExpireDays(e.target.value)}
                placeholder={t('tokens.expireDaysPlaceholder')}
              />
              <p className="text-sm text-muted-foreground">{t('tokens.expireDaysHint')}</p>
            </div>

            {createMutation.error && (
              <Note variant="error">
                {createMutation.error instanceof Error ? createMutation.error.message : t('common.failedToAdd')}
              </Note>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? t('common.adding') : t('tokens.create.createButton')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Token Created Dialog */}
      <Dialog open={dialogMode === 'created'} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('tokens.created.title')}</DialogTitle>
            <DialogDescription>
              {t('tokens.created.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Note variant="warning">
              {t('tokens.created.warning')}
            </Note>
            <div className="space-y-2">
              <Label>{t('tokens.created.tokenValue')}</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={newToken?.token || ''}
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => newToken && copyToClipboard(newToken.token)}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>{t('tokens.created.usage')}:</strong></p>
              <p>{t('tokens.created.usageHint')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={closeDialog}>
              {t('tokens.created.done')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
