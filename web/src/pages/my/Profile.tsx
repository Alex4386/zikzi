import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Save, CheckCircle, Key } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { PageContainer } from '@/components/PageContainer'
import { Note } from '@/components/Note'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Profile() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [displayName, setDisplayName] = useState(user?.display_name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [saved, setSaved] = useState(false)

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const updateMutation = useMutation({
    mutationFn: () => api.updateUser({ display_name: displayName, email }),
    onSuccess: () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const passwordMutation = useMutation({
    mutationFn: () => api.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      setPasswordSaved(true)
      setPasswordError(null)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSaved(false), 3000)
    },
    onError: (err: Error) => {
      setPasswordError(err.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate()
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    if (newPassword !== confirmPassword) {
      setPasswordError(t('profile.passwordsDoNotMatch'))
      return
    }
    if (newPassword.length < 8) {
      setPasswordError(t('profile.passwordTooShort'))
      return
    }
    passwordMutation.mutate()
  }

  return (
    <PageContainer>
      <h1 className="text-2xl font-bold mb-6">{t('profile.title')}</h1>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('profile.yourInfo')}</CardTitle>
            <CardDescription>{t('profile.yourInfoDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">{t('auth.username')}</Label>
                <Input
                  id="username"
                  type="text"
                  value={user?.username || ''}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">{t('profile.usernameCannotChange')}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">{t('auth.displayName')}</Label>
                <Input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={updateMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {updateMutation.isPending ? t('common.saving') : t('profile.saveChanges')}
                </Button>

                {saved && (
                  <span className="flex items-center gap-2 text-green-500">
                    <CheckCircle className="h-4 w-4" />
                    {t('common.saved')}
                  </span>
                )}
              </div>

              {updateMutation.error && (
                <Note variant="error">
                  {updateMutation.error instanceof Error ? updateMutation.error.message : t('common.failedToSave')}
                </Note>
              )}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('profile.changePassword')}</CardTitle>
            <CardDescription>{t('profile.changePasswordDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">{t('profile.currentPassword')}</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">{t('profile.newPassword')}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground">{t('profile.passwordMinLength')}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('profile.confirmPassword')}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={passwordMutation.isPending}>
                  <Key className="h-4 w-4 mr-2" />
                  {passwordMutation.isPending ? t('profile.changing') : t('profile.changePassword')}
                </Button>

                {passwordSaved && (
                  <span className="flex items-center gap-2 text-green-500">
                    <CheckCircle className="h-4 w-4" />
                    {t('profile.passwordUpdated')}
                  </span>
                )}
              </div>

              {passwordError && (
                <Note variant="error">
                  {passwordError}
                </Note>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
