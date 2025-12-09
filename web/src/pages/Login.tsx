import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Printer, Sun, Moon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Note } from '@/components/Note'
import { Separator } from '@/components/ui/separator'

interface Config {
  allow_local: boolean
  sso_enabled: boolean
}

export default function Login() {
  const { t } = useTranslation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  const toggleTheme = () => {
    if (theme === 'dark') {
      setTheme('light')
    } else {
      setTheme('dark')
    }
  }

  const { data: config, isLoading: configLoading } = useQuery<Config>({
    queryKey: ['config'],
    queryFn: async () => {
      const res = await fetch('/api/v1/config')
      if (!res.ok) throw new Error('Failed to fetch config')
      return res.json()
    },
  })

  const allowLocal = config?.allow_local ?? true
  const ssoEnabled = config?.sso_enabled ?? false

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await login(username, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  if (configLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-muted-foreground">{t('common.loading')}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className="absolute top-4 right-4"
      >
        <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        <span className="sr-only">{t('common.toggleTheme')}</span>
      </Button>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Printer className="h-16 w-16 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Zikzi</h1>
          <p className="text-muted-foreground mt-2">{t('auth.signInSubtitle')}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('auth.welcomeBack')}</CardTitle>
            <CardDescription>
              {allowLocal && ssoEnabled
                ? t('auth.enterCredentialsOrSSO')
                : allowLocal
                  ? t('auth.enterCredentials')
                  : t('auth.useSSO')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {error && (
                <Note variant="error">
                  {error}
                </Note>
              )}

              {allowLocal && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">{t('auth.username')}</Label>
                    <Input
                      type="text"
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">{t('auth.password')}</Label>
                    <Input
                      type="password"
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? t('auth.signInLoading') : t('auth.signIn')}
                  </Button>
                </form>
              )}

              {allowLocal && ssoEnabled && (
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <Separator />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">{t('common.or')}</span>
                  </div>
                </div>
              )}

              {ssoEnabled && (
                <Button variant={allowLocal ? 'secondary' : 'default'} className="w-full" asChild>
                  <a href="/api/v1/auth/oidc/login">{t('auth.signInWithSSO')}</a>
                </Button>
              )}

              {!allowLocal && !ssoEnabled && (
                <Note variant="error">
                  {t('auth.noAuthMethods')}
                </Note>
              )}
            </div>
          </CardContent>
        </Card>

        {allowLocal && (
          <p className="text-center mt-4 text-muted-foreground">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="text-primary hover:underline">
              {t('auth.signUp')}
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
