import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Save, CheckCircle, Key } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { PageContainer } from '@/components/PageContainer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function Profile() {
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
      setPasswordError('New passwords do not match')
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      return
    }
    passwordMutation.mutate()
  }

  return (
    <PageContainer>
      <h1 className="text-2xl font-bold mb-6">Profile & Security</h1>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your Information</CardTitle>
            <CardDescription>Update your display name and email address</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={user?.username || ''}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">Username cannot be changed</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
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
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>

                {saved && (
                  <span className="flex items-center gap-2 text-green-500">
                    <CheckCircle className="h-4 w-4" />
                    Saved
                  </span>
                )}
              </div>

              {updateMutation.error && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {updateMutation.error instanceof Error ? updateMutation.error.message : 'Failed to save'}
                  </AlertDescription>
                </Alert>
              )}
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your password to keep your account secure</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
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
                  {passwordMutation.isPending ? 'Changing...' : 'Change Password'}
                </Button>

                {passwordSaved && (
                  <span className="flex items-center gap-2 text-green-500">
                    <CheckCircle className="h-4 w-4" />
                    Password changed
                  </span>
                )}
              </div>

              {passwordError && (
                <Alert variant="destructive">
                  <AlertDescription>{passwordError}</AlertDescription>
                </Alert>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  )
}
