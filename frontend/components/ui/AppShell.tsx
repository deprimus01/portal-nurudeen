'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  LogOut,
  LucideIcon,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  X,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { LanguageSwitcher } from './LanguageSwitcher';
import { PageTransition } from './PageTransition';
import { useLanguage } from '../../lib/i18n/language-context';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

interface AppShellProps {
  navGroups: NavGroup[];
  roleLabel: string;
  userName: string;
  userEmail?: string;
  onLogout: () => void;
  children: React.ReactNode;
  /** hrefs shown in the mobile bottom nav (max 4) - defaults to first 4 items across all groups */
  mobilePrimaryHrefs?: string[];
}

const EASE = [0.16, 1, 0.3, 1] as const;

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AppShell({
  navGroups,
  roleLabel,
  userName,
  userEmail,
  onLogout,
  children,
  mobilePrimaryHrefs,
}: AppShellProps) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    setDateStr(
      new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
    );
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  const allItems = useMemo(() => navGroups.flatMap((g) => g.items), [navGroups]);
  const activeItem = allItems.find((item) => item.href === pathname);

  const bottomItems = useMemo(() => {
    if (mobilePrimaryHrefs) {
      return mobilePrimaryHrefs
        .map((href) => allItems.find((i) => i.href === href))
        .filter(Boolean) as NavItem[];
    }
    return allItems.slice(0, 4);
  }, [allItems, mobilePrimaryHrefs]);

  const initials = initialsFor(userName);

  const sidebarContent = (
    <>
      <div className="shell-sidebar-head">
        <div className="shell-brand">
          <img src="/images/logo.png" alt="Nuruddeen Schools" className="shell-brand-mark" />
          {!collapsed && (
            <div className="shell-brand-text">
              <div className="name">Nuruddeen Schools</div>
              <div className="role">{roleLabel}</div>
            </div>
          )}
        </div>
        <button
          type="button"
          className="shell-collapse-btn"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      <nav className="shell-nav" aria-label="Primary">
        {navGroups.map((group) => (
          <div className="shell-nav-group" key={group.label}>
            {!collapsed && <div className="shell-group-label">{group.label}</div>}
            {group.items.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shell-nav-item${active ? ' active' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon size={17} strokeWidth={2} />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="shell-sidebar-foot">
        <button type="button" className="shell-nav-item shell-logout" onClick={onLogout}>
          <LogOut size={17} />
          {!collapsed && <span>{t('common.logout')}</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="app-shell">
      {/* Desktop floating sidebar */}
      <aside className={`shell-sidebar${collapsed ? ' collapsed' : ''}`}>{sidebarContent}</aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="shell-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="shell-sidebar shell-sidebar-mobile"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ duration: 0.32, ease: EASE }}
            >
              <button className="shell-mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X size={18} />
              </button>
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="shell-body">
        <header className="shell-topbar">
          <button
            type="button"
            className="shell-hamburger"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={19} />
          </button>

          <div className="shell-breadcrumb">
            <span>Nuruddeen SMS</span>
            <span className="sep">/</span>
            <b>{activeItem?.label ?? roleLabel}</b>
          </div>

          <div className="shell-search">
            <Search size={15} />
            <span>{t('common.search')}</span>
          </div>

          <div className="shell-topbar-actions">
            <div className="shell-date">{dateStr}</div>
            <LanguageSwitcher compact />
            <ThemeToggle compact />
            <div className="shell-profile-wrap">
              <button
                type="button"
                className="shell-profile-chip"
                onClick={() => setProfileOpen((o) => !o)}
              >
                <div className="shell-avatar">{initials}</div>
                <div className="shell-profile-text">
                  <div className="pname">{userName}</div>
                  <div className="prole">{roleLabel}</div>
                </div>
                <ChevronDown size={14} />
              </button>
              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    className="shell-profile-menu"
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.16, ease: EASE }}
                  >
                    <div className="shell-profile-menu-head">
                      <div className="shell-avatar">{initials}</div>
                      <div>
                        <div className="pname">{userName}</div>
                        {userEmail && <div className="prole">{userEmail}</div>}
                      </div>
                    </div>
                    <div className="shell-profile-menu-item disabled">
                      <Settings size={15} /> {t('common.settings')}
                    </div>
                    <div className="shell-profile-menu-item danger" onClick={onLogout}>
                      <LogOut size={15} /> {t('common.logout')}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <main className="main-content">
          <PageTransition>{children}</PageTransition>
        </main>

        {/* Mobile bottom nav */}
        {bottomItems.length > 0 && (
          <nav className="shell-bottom-nav" aria-label="Primary mobile">
            {bottomItems.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className={`shell-bottom-item${active ? ' active' : ''}`}>
                  <Icon size={19} strokeWidth={active ? 2.4 : 2} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <button type="button" className="shell-bottom-item" onClick={() => setMobileOpen(true)}>
              <Menu size={19} />
              <span>More</span>
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
