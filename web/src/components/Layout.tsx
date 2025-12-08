import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { Printer, Network, LogOut, FileText, User, ChevronUp, ChevronDown, Sun, Moon, Monitor } from 'lucide-react'
import { Shield, Users, AlertTriangle, LayoutDashboard } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/components/theme-provider'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function Layout() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [adminOpen, setAdminOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navItems = [
    { to: '/', icon: FileText, label: 'Print Jobs' },
    { to: '/ips', icon: Network, label: 'IP Addresses' },
    { to: '/settings', icon: Printer, label: 'Printer Setup' },
  ]

  const adminItems = [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/users', icon: Users, label: 'Users' },
    { to: '/admin/jobs', icon: FileText, label: 'All Jobs' },
    { to: '/admin/orphaned', icon: AlertTriangle, label: 'Orphaned Jobs' },
  ]

  const isActive = (to: string) => {
    if (to === '/') return location.pathname === '/'
    if (to === '/admin') return location.pathname === '/admin'
    return location.pathname.startsWith(to)
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="border-b border-sidebar-border">
          <div className="flex items-center gap-2 px-2 py-2">
            <Printer className="h-6 w-6 text-sidebar-primary" />
            <span className="text-lg font-semibold">Zikzi</span>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map(({ to, icon: Icon, label }) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton asChild isActive={isActive(to)} tooltip={label}>
                      <NavLink to={to}>
                        <Icon />
                        <span>{label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {user?.is_admin && (
            <Collapsible open={adminOpen} onOpenChange={setAdminOpen}>
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent rounded-md transition-colors">
                    <Shield className="mr-2 h-4 w-4" />
                    Admin
                    <ChevronDown className={`ml-auto h-4 w-4 transition-transform ${adminOpen ? 'rotate-180' : ''}`} />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {adminItems.map(({ to, icon: Icon, label }) => (
                        <SidebarMenuItem key={to}>
                          <SidebarMenuButton asChild isActive={isActive(to)} tooltip={label}>
                            <NavLink to={to}>
                              <Icon />
                              <span>{label}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          )}
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton className="w-full">
                    <User className="h-4 w-4" />
                    <div className="flex flex-1 flex-col items-start overflow-hidden">
                      <span className="truncate font-medium">{user?.display_name || user?.username}</span>
                      <span className="truncate text-xs text-sidebar-foreground/70">{user?.email}</span>
                    </div>
                    <ChevronUp className="ml-auto h-4 w-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-56">
                  <DropdownMenuItem onClick={() => navigate('/my/profile')}>
                    <User className="mr-2 h-4 w-4" />
                    Profile & Security
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      {theme === 'light' ? (
                        <Sun className="mr-2 h-4 w-4" />
                      ) : theme === 'dark' ? (
                        <Moon className="mr-2 h-4 w-4" />
                      ) : (
                        <Monitor className="mr-2 h-4 w-4" />
                      )}
                      Theme
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => setTheme('light')}>
                        <Sun className="mr-2 h-4 w-4" />
                        Light
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('dark')}>
                        <Moon className="mr-2 h-4 w-4" />
                        Dark
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setTheme('system')}>
                        <Monitor className="mr-2 h-4 w-4" />
                        System
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
        </header>
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
