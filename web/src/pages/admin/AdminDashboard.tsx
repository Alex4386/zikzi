import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Users, FileText, Calendar, BookOpen, AlertTriangle, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { PageContainer } from '@/components/PageContainer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function AdminDashboard() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => api.getAdminStats(),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-destructive">
          Failed to load admin stats
        </div>
      </div>
    )
  }

  const statCards = [
    {
      title: 'Total Users',
      value: stats?.total_users ?? 0,
      icon: Users,
      link: '/admin/users',
    },
    {
      title: 'Total Jobs',
      value: stats?.total_jobs ?? 0,
      icon: FileText,
      link: '/admin/jobs',
    },
    {
      title: 'Jobs Today',
      value: stats?.jobs_today ?? 0,
      icon: Calendar,
    },
    {
      title: 'Total Pages',
      value: stats?.total_pages ?? 0,
      icon: BookOpen,
    },
    {
      title: 'Orphaned Jobs',
      value: stats?.orphaned_jobs ?? 0,
      icon: AlertTriangle,
      link: '/admin/orphaned',
      variant: (stats?.orphaned_jobs ?? 0) > 0 ? 'warning' : 'default',
    },
  ]

  return (
    <PageContainer>
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {statCards.map((stat) => {
          const Icon = stat.icon
          const content = (
            <Card className={stat.variant === 'warning' && stat.value > 0 ? 'border-yellow-500' : ''}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className={`h-4 w-4 ${stat.variant === 'warning' && stat.value > 0 ? 'text-yellow-500' : 'text-muted-foreground'}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
              </CardContent>
            </Card>
          )

          if (stat.link) {
            return (
              <Link key={stat.title} to={stat.link} className="hover:opacity-80 transition-opacity">
                {content}
              </Link>
            )
          }

          return <div key={stat.title}>{content}</div>
        })}
      </div>
    </PageContainer>
  )
}
