'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  LogOut,
  LucideIcon,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  X,
} from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { PageTransition } from './PageTransition';
import { CommandCenter } from './CommandCenter';
import { Toggle } from './Toggle';
import { useLanguage } from '../../lib/i18n/language-context';
import { useTheme } from '../../lib/theme-context';
import { CommandCenterProvider, useCommandCenter } from '../../lib/command-center-context';
import type { CommandAction } from '../../lib/commandActions';

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
  /** where the profile-menu "Settings" item links to */
  settingsHref?: string;
  /** powers the ⌘K command center — omit to leave the palette disabled */
  commandActions?: CommandAction[];
  commandSecondaryActions?: CommandAction[];
}

const EASE = [0.16, 1, 0.3, 1] as const;

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AppShell(props: AppShellProps) {
  return (
    <CommandCenterProvider>
      <AppShellBody {...props} />
    </CommandCenterProvider>
  );
}

function AppShellBody({
  navGroups,
  roleLabel,
  userName,
  userEmail,
  onLogout,
  children,
  mobilePrimaryHrefs,
  settingsHref,
  commandActions = [],
  commandSecondaryActions = [],
}: AppShellProps) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';
  const { isOpen: cmdkOpen, open: openCmdk, close: closeCmdk, onExitComplete: cmdkExitComplete } = useCommandCenter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [dateStr, setDateStr] = useState('');
  const profileWrapRef = useRef<HTMLDivElement>(null);

  // Same interrupted-exit race as the command center (see
  // command-center-context.tsx) applies to this drawer's own
  // AnimatePresence: if it's reopened while its backdrop/panel are still
  // animating out, the exit and a fresh enter can overlap and leave a
  // stale node mounted. Guard it the same way.
  //
  // Unlike the command center, this drawer's close is also fired
  // automatically on every pathname change (see the effect below), racing
  // PageTransition's own AnimatePresence swap on the same tick. If that
  // contention ever causes Framer Motion's onExitComplete to stall or get
  // skipped, mobileClosingRef would otherwise stay stuck "true" forever -
  // silently no-op'ing both the hamburger and "More" button (they share
  // this same gate). MOBILE_CLOSE_FALLBACK_MS bounds that wait so the ref
  // always self-clears even if onExitComplete never fires - it mirrors
  // the exit transition's own duration below, it's not an arbitrary delay.
  const MOBILE_CLOSE_FALLBACK_MS = 400; // 320ms exit transition + buffer
  const mobileClosingRef = useRef(false);
  const mobilePendingOpenRef = useRef(false);
  const mobileClosingFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearMobileClosingFallback = useCallback(() => {
    if (mobileClosingFallbackRef.current) {
      clearTimeout(mobileClosingFallbackRef.current);
      mobileClosingFallbackRef.current = null;
    }
  }, []);

  const handleMobileExitComplete = useCallback(() => {
    clearMobileClosingFallback();
    mobileClosingRef.current = false;
    if (mobilePendingOpenRef.current) {
      mobilePendingOpenRef.current = false;
      setMobileOpen(true);
    }
  }, [clearMobileClosingFallback]);

  const openMobileSidebar = useCallback(() => {
    if (mobileClosingRef.current) {
      mobilePendingOpenRef.current = true;
      return;
    }
    setMobileOpen(true);
  }, []);

  const closeMobileSidebar = useCallback(() => {
    setMobileOpen((prev) => {
      if (prev) {
        mobileClosingRef.current = true;
        clearMobileClosingFallback();
        mobileClosingFallbackRef.current = setTimeout(
          handleMobileExitComplete,
          MOBILE_CLOSE_FALLBACK_MS,
        );
      }
      return false;
    });
  }, [clearMobileClosingFallback, handleMobileExitComplete]);

  useEffect(() => () => clearMobileClosingFallback(), [clearMobileClosingFallback]);

  useEffect(() => {
    setDateStr(
      new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
    );
  }, []);

  useEffect(() => {
    closeMobileSidebar();
    setProfileOpen(false);
    // goToAction/goToEntity already call closeCmdk() before navigating,
    // but browser back/forward and any other route change that doesn't
    // go through those two functions wouldn't otherwise close the
    // palette - leaving cmdkOpen (and its backdrop) mounted on a page
    // the user never explicitly closed it on.
    closeCmdk();
  }, [pathname, closeMobileSidebar, closeCmdk]);

  // Profile menu was the one dropdown in the app without outside-click
  // handling (LanguageSwitcher, ActionMenu, and NotificationBell all do
  // this already) - it only closed on route change, so it could be left
  // open indefinitely by any click elsewhere on the page.
  useEffect(() => {
    if (!profileOpen) return;
    function onDocClick(e: MouseEvent) {
      if (profileWrapRef.current && !profileWrapRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setProfileOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [profileOpen]);

  useEffect(() => {
    if (commandActions.length === 0) return;
    function handleKeyDown(e: KeyboardEvent) {
      const isTypingTarget =
        e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openCmdk();
        return;
      }
      if (e.key === '/' && !isTypingTarget) {
        e.preventDefault();
        openCmdk();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandActions.length, openCmdk]);

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

  const renderSidebarContent = (variant: 'desktop' | 'mobile') => (
    <>
      <div className="shell-sidebar-head">
        <div className="shell-brand">
          <img src="/images/logo.png" alt="Nuruddeen Schools" className="shell-logo-mark" />
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
                  {active && (
                    <motion.span
                      className="shell-nav-active-bar"
                      layoutId={`shellNavActiveBar-${variant}`}
                      transition={{ duration: 0.28, ease: EASE }}
                    />
                  )}
                  <span className="shell-nav-icon">
                    <Icon size={16} strokeWidth={2} />
                  </span>
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </>
  );

  return (
    <div className="app-shell">
      {/* Desktop floating sidebar */}
      <aside className={`shell-sidebar${collapsed ? ' collapsed' : ''}`}>{renderSidebarContent('desktop')}</aside>

      {/* Mobile drawer */}
      <AnimatePresence onExitComplete={handleMobileExitComplete}>
        {mobileOpen && (
          <>
            <motion.div
              className="shell-backdrop"
              initial={{ opacity: 0, pointerEvents: 'none' }}
              animate={{ opacity: 1, pointerEvents: 'auto' }}
              exit={{ opacity: 0, pointerEvents: 'none' }}
              onClick={() => closeMobileSidebar()}
            />
            <motion.aside
              className="shell-sidebar shell-sidebar-mobile"
              initial={{ x: -300, pointerEvents: 'none' }}
              animate={{ x: 0, pointerEvents: 'auto' }}
              exit={{ x: -300, pointerEvents: 'none' }}
              transition={{ duration: 0.32, ease: EASE }}
            >
              <button className="shell-mobile-close" onClick={() => closeMobileSidebar()} aria-label="Close menu">
                <X size={18} />
              </button>
              {renderSidebarContent('mobile')}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="shell-body">
        <header className="shell-topbar">
          <button
            type="button"
            className="shell-hamburger"
            onClick={() => openMobileSidebar()}
            aria-label="Open menu"
          >
            <Menu size={19} />
          </button>

          <div className="shell-breadcrumb">
            <span>Nuruddeen SMS</span>
            <span className="sep">/</span>
            <b>{activeItem?.label ?? roleLabel}</b>
          </div>

          {commandActions.length > 0 ? (
            <button type="button" className="shell-search" onClick={openCmdk}>
              <Search size={15} />
              <span>{t('common.search')}</span>
              <kbd className="shell-search-kbd">⌘K</kbd>
            </button>
          ) : (
            <div className="shell-search">
              <Search size={15} />
              <span>{t('common.search')}</span>
            </div>
          )}

          <div className="shell-topbar-actions">
            {commandActions.length > 0 && (
              <button
                type="button"
                className="shell-cmdk-btn"
                onClick={openCmdk}
                aria-label="Open command center"
                title="Command center (⌘K)"
              >
                <Search size={16} />
              </button>
            )}
            <div className="shell-date">{dateStr}</div>
            <div className="shell-profile-wrap" ref={profileWrapRef}>
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
                    <NotificationBell variant="menuItem" />
                    <div className="shell-profile-menu-item shell-profile-menu-toggle">
                      <span className="shell-profile-menu-item-label">
                        <Moon size={15} /> Dark mode
                      </span>
                      <Toggle checked={isDark} onChange={(next) => setTheme(next ? 'dark' : 'light')} label="Dark mode" />
                    </div>
                    {settingsHref ? (
                      <Link
                        href={settingsHref}
                        className="shell-profile-menu-item"
                        onClick={() => setProfileOpen(false)}
                      >
                        <Settings size={15} /> {t('common.settings')}
                      </Link>
                    ) : (
                      <div className="shell-profile-menu-item disabled">
                        <Settings size={15} /> {t('common.settings')}
                      </div>
                    )}
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
            <button type="button" className="shell-bottom-item" onClick={() => openMobileSidebar()}>
              <Menu size={19} />
              <span>More</span>
            </button>
          </nav>
        )}
      </div>

      {commandActions.length > 0 && (
        <CommandCenter
          isOpen={cmdkOpen}
          onClose={closeCmdk}
          actions={commandActions}
          secondaryActions={commandSecondaryActions}
          roleLabel={roleLabel}
          onExitComplete={cmdkExitComplete}
        />
      )}
    </div>
  );
}
