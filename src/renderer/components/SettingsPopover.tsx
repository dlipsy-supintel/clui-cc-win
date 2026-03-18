import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import {
  DotsThree, Bell, ArrowsOutSimple, Moon,
  Terminal, Code, Globe, Microphone, CaretDown,
} from '@phosphor-icons/react'
import { useThemeStore } from '../theme'
import { useSessionStore } from '../stores/sessionStore'
import { usePopoverLayer } from './PopoverLayer'
import { useColors } from '../theme'
import type { AppInfo, InstalledApps } from '../../shared/types'

// ─── Shared sub-components ───

function RowToggle({
  checked,
  onChange,
  colors,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  colors: ReturnType<typeof useColors>
  label: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className="relative w-9 h-5 rounded-full transition-colors"
      style={{
        background: checked ? colors.accent : colors.surfaceSecondary,
        border: `1px solid ${checked ? colors.accent : colors.containerBorder}`,
      }}
    >
      <span
        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full transition-all"
        style={{
          left: checked ? 18 : 2,
          background: '#fff',
        }}
      />
    </button>
  )
}

function SectionHeader({ label, colors }: { label: string; colors: ReturnType<typeof useColors> }) {
  return (
    <div
      className="text-[10px] font-semibold uppercase tracking-wider"
      style={{ color: colors.textTertiary, marginBottom: 2 }}
    >
      {label}
    </div>
  )
}

// ─── App Picker row ───

const SETTINGS_STORAGE_KEY = 'clui-app-settings'

function loadAppSettings(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveAppSettings(data: Record<string, string>): void {
  try { localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(data)) } catch {}
}

function AppPicker({
  label,
  icon,
  settingKey,
  apps,
  colors,
}: {
  label: string
  icon: React.ReactNode
  settingKey: string
  apps: AppInfo[]
  colors: ReturnType<typeof useColors>
}) {
  const [selected, setSelected] = useState<string>(() => loadAppSettings()[settingKey] || '')

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setSelected(val)
    const current = loadAppSettings()
    current[settingKey] = val
    saveAppSettings(current)
  }

  if (apps.length === 0) return null

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span style={{ color: colors.textTertiary }}>{icon}</span>
        <div className="text-[12px] font-medium truncate" style={{ color: colors.textPrimary }}>{label}</div>
      </div>
      <div className="relative flex-shrink-0" style={{ minWidth: 0 }}>
        <select
          value={selected}
          onChange={handleChange}
          className="appearance-none text-[11px] font-medium rounded-lg pr-5 pl-2 py-1 cursor-pointer"
          style={{
            background: colors.surfacePrimary,
            border: `1px solid ${colors.containerBorder}`,
            color: colors.textPrimary,
            maxWidth: 130,
          }}
        >
          {!selected && <option value="">Pick one…</option>}
          {apps.map((a) => (
            <option key={a.path} value={a.path}>{a.name}</option>
          ))}
        </select>
        <CaretDown
          size={10}
          style={{
            position: 'absolute',
            right: 6,
            top: '50%',
            transform: 'translateY(-50%)',
            color: colors.textTertiary,
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  )
}

// ─── Voice Mode info row ───

const VOICE_APPS = [
  { name: 'Superwhisper', url: 'superwhisper.com' },
  { name: 'WisprFlow', url: 'wisprflow.com' },
  { name: 'VoiceInk', url: 'voiceink.app' },
  { name: 'Voibe', url: 'voibe.app' },
  { name: 'Aqua Voice', url: 'withaqua.com' },
  { name: 'MacWhisper', url: 'goodsnooze.gumroad.com' },
]

function VoiceModeSection({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <div>
      <SectionHeader label="Voice Mode" colors={colors} />
      <div
        className="rounded-lg p-2.5 mt-1"
        style={{
          background: colors.surfacePrimary,
          border: `1px solid ${colors.containerBorder}`,
          fontSize: 11,
          color: colors.textSecondary,
          lineHeight: 1.5,
        }}
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          <Microphone size={13} style={{ color: colors.accent, flexShrink: 0 }} />
          <span className="font-medium" style={{ color: colors.textPrimary }}>MCP Voice Server</span>
        </div>
        <div style={{ color: colors.textTertiary, fontSize: 10.5 }}>
          Voice apps connect via CLUI's local MCP server on{' '}
          <span style={{ color: colors.accent, fontFamily: 'monospace' }}>localhost:7783</span>.
          Compatible apps:
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {VOICE_APPS.map((v) => (
            <span
              key={v.name}
              className="rounded px-1.5 py-0.5"
              style={{
                background: colors.accentLight,
                color: colors.accent,
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              {v.name}
            </span>
          ))}
        </div>
        <div className="mt-2" style={{ color: colors.textTertiary, fontSize: 10 }}>
          Integration coming soon — voice apps will need to add CLUI MCP support.
        </div>
      </div>
    </div>
  )
}

/* ─── Settings popover ─── */

export function SettingsPopover() {
  const soundEnabled = useThemeStore((s) => s.soundEnabled)
  const setSoundEnabled = useThemeStore((s) => s.setSoundEnabled)
  const themeMode = useThemeStore((s) => s.themeMode)
  const setThemeMode = useThemeStore((s) => s.setThemeMode)
  const expandedUI = useThemeStore((s) => s.expandedUI)
  const setExpandedUI = useThemeStore((s) => s.setExpandedUI)
  const isExpanded = useSessionStore((s) => s.isExpanded)
  const popoverLayer = usePopoverLayer()
  const colors = useColors()

  const [open, setOpen] = useState(false)
  const [installedApps, setInstalledApps] = useState<InstalledApps | null>(null)
  const [appsLoading, setAppsLoading] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ right: number; top?: number; bottom?: number; maxHeight?: number }>({ right: 0 })

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const gap = 6
    const margin = 8
    const right = window.innerWidth - rect.right

    if (isExpanded) {
      const top = rect.bottom + gap
      setPos({
        top,
        right,
        maxHeight: Math.max(200, window.innerHeight - top - margin),
      })
      return
    }

    setPos({
      bottom: window.innerHeight - rect.top + gap,
      right,
      maxHeight: Math.max(200, rect.top - gap - margin),
    })
  }, [isExpanded])

  // Scan apps when first opened
  useEffect(() => {
    if (!open || installedApps || appsLoading) return
    if (!window.clui?.scanApps) return
    setAppsLoading(true)
    window.clui.scanApps()
      .then((apps) => { setInstalledApps(apps); setAppsLoading(false) })
      .catch(() => setAppsLoading(false))
  }, [open, installedApps, appsLoading])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target)) return
      if (popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onResize = () => updatePos()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [open, updatePos])

  useEffect(() => {
    if (!open) return
    let raf = 0
    const tick = () => {
      updatePos()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      if (raf) cancelAnimationFrame(raf)
    }
  }, [open, expandedUI, isExpanded, updatePos])

  const handleToggle = () => {
    if (!open) updatePos()
    setOpen((o) => !o)
  }

  const divider = <div style={{ height: 1, background: colors.popoverBorder }} />

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-colors"
        style={{ color: colors.textTertiary }}
        title="Settings"
      >
        <DotsThree size={16} weight="bold" />
      </button>

      {popoverLayer && open && createPortal(
        <motion.div
          ref={popoverRef}
          data-clui-ui
          initial={{ opacity: 0, y: isExpanded ? -4 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: isExpanded ? -4 : 4 }}
          transition={{ duration: 0.12 }}
          className="rounded-xl"
          style={{
            position: 'fixed',
            ...(pos.top != null ? { top: pos.top } : {}),
            ...(pos.bottom != null ? { bottom: pos.bottom } : {}),
            right: pos.right,
            width: 280,
            pointerEvents: 'auto',
            background: colors.popoverBg,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: colors.popoverShadow,
            border: `1px solid ${colors.popoverBorder}`,
            ...(pos.maxHeight != null ? { maxHeight: pos.maxHeight, overflowY: 'auto' as const } : {}),
          }}
        >
          <div className="p-3 flex flex-col gap-2.5">

            {/* ─── Appearance ─── */}
            <SectionHeader label="Appearance" colors={colors} />

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <ArrowsOutSimple size={14} style={{ color: colors.textTertiary }} />
                <div className="text-[12px] font-medium" style={{ color: colors.textPrimary }}>Full width</div>
              </div>
              <RowToggle
                checked={expandedUI}
                onChange={setExpandedUI}
                colors={colors}
                label="Toggle full width panel"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Moon size={14} style={{ color: colors.textTertiary }} />
                <div className="text-[12px] font-medium" style={{ color: colors.textPrimary }}>Dark theme</div>
              </div>
              <RowToggle
                checked={themeMode === 'dark'}
                onChange={(next) => setThemeMode(next ? 'dark' : 'light')}
                colors={colors}
                label="Toggle dark theme"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Bell size={14} style={{ color: colors.textTertiary }} />
                <div className="text-[12px] font-medium" style={{ color: colors.textPrimary }}>Notification sound</div>
              </div>
              <RowToggle
                checked={soundEnabled}
                onChange={setSoundEnabled}
                colors={colors}
                label="Toggle notification sound"
              />
            </div>

            {divider}

            {/* ─── App Pickers ─── */}
            <SectionHeader label="Default Apps" colors={colors} />
            {appsLoading && (
              <div className="text-[11px]" style={{ color: colors.textTertiary }}>Scanning /Applications…</div>
            )}
            {installedApps && (
              <div className="flex flex-col gap-2">
                <AppPicker
                  label="Terminal"
                  icon={<Terminal size={14} />}
                  settingKey="terminal"
                  apps={installedApps.terminals}
                  colors={colors}
                />
                <AppPicker
                  label="Editor"
                  icon={<Code size={14} />}
                  settingKey="editor"
                  apps={installedApps.editors}
                  colors={colors}
                />
                <AppPicker
                  label="Browser"
                  icon={<Globe size={14} />}
                  settingKey="browser"
                  apps={installedApps.browsers}
                  colors={colors}
                />
              </div>
            )}
            {!appsLoading && !installedApps && (
              <div className="text-[11px]" style={{ color: colors.textTertiary }}>
                App scanning unavailable
              </div>
            )}

            {divider}

            {/* ─── Voice Mode ─── */}
            <VoiceModeSection colors={colors} />
          </div>
        </motion.div>,
        popoverLayer,
      )}
    </>
  )
}
