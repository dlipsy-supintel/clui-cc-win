import React, { useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowsOut, Sun, Gear, Plus, CaretDown, CaretUp,
  Sparkle, Camera, Paperclip, ClockCounterClockwise,
} from '@phosphor-icons/react'
import { useSessionStore, AVAILABLE_MODELS } from '../stores/sessionStore'
import { useColors, useThemeStore } from '../theme'
import { InputBar } from './InputBar'
import { MarketplacePanel } from './MarketplacePanel'
import { HistoryPicker } from './HistoryPicker'
import type { TabStatus } from '../../shared/types'

const TRANSITION = { duration: 0.22, ease: [0.4, 0, 0.1, 1] as const }

// ─── Title bar icon button ───

function TitleBarBtn({
  onClick,
  title,
  children,
}: {
  onClick?: () => void
  title?: string
  children: React.ReactNode
}) {
  const colors = useColors()
  return (
    <button
      data-clui-ui
      className="no-drag mini-title-btn"
      onClick={onClick}
      title={title}
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: colors.textTertiary,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

// ─── Circle action button (swing-out panel) ───

function ActionCircle({
  onClick,
  title,
  children,
  disabled = false,
}: {
  onClick?: () => void
  title?: string
  children: React.ReactNode
  disabled?: boolean
}) {
  const colors = useColors()
  return (
    <button
      data-clui-ui
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: disabled ? colors.btnDisabled : colors.textTertiary,
        background: colors.surfacePrimary,
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        flexShrink: 0,
        transition: 'background 0.15s, color 0.15s',
      }}
    >
      {children}
    </button>
  )
}

// ─── Status dot (mirrors logic from TabStrip's StatusDot) ───

function MiniStatusDot({
  status,
  hasPermission,
}: {
  status: TabStatus | undefined
  hasPermission: boolean
}) {
  const colors = useColors()
  if (!status || status === 'idle') return null

  let bg = colors.statusIdle
  let pulse = false

  if (status === 'dead' || status === 'failed') {
    bg = colors.statusError
  } else if (hasPermission) {
    bg = colors.statusPermission
  } else if (status === 'connecting' || status === 'running') {
    bg = colors.statusRunning
    pulse = true
  }

  return (
    <span
      className={`flex-shrink-0 ${pulse ? 'animate-pulse-dot' : ''}`}
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: bg,
        display: 'inline-block',
        marginRight: 4,
      }}
    />
  )
}

// ─── Model label badge ───

function ModelBadge() {
  const preferredModel = useSessionStore((s) => s.preferredModel)
  const tab = useSessionStore((s) => s.tabs.find((t) => t.id === s.activeTabId))
  const colors = useColors()

  const resolvedId = preferredModel || tab?.sessionModel || AVAILABLE_MODELS[0].id
  const found = AVAILABLE_MODELS.find((m) => m.id === resolvedId)
  const label = found?.label || 'Opus 4.6'

  return (
    <div
      style={{
        padding: '4px 10px',
        borderRadius: 8,
        background: colors.surfacePrimary,
        fontSize: 11,
        fontWeight: 600,
        color: colors.textTertiary,
      }}
    >
      {label}
    </div>
  )
}

// ─── Permission mode badge ───

function PermissionBadge() {
  const permissionMode = useSessionStore((s) => s.permissionMode)
  const colors = useColors()
  return (
    <div
      style={{
        padding: '4px 10px',
        borderRadius: 8,
        background: colors.surfacePrimary,
        fontSize: 11,
        fontWeight: 600,
        color: colors.textTertiary,
      }}
    >
      {permissionMode === 'auto' ? 'Auto' : 'Ask'}
    </div>
  )
}

// ─── Main MiniPlayer ───

export function MiniPlayer() {
  const isExpanded = useSessionStore((s) => s.isExpanded)
  const toggleExpanded = useSessionStore((s) => s.toggleExpanded)
  const createTab = useSessionStore((s) => s.createTab)
  const tabs = useSessionStore((s) => s.tabs)
  const activeTabId = useSessionStore((s) => s.activeTabId)
  const activeTab = useSessionStore((s) => s.tabs.find((t) => t.id === s.activeTabId))
  const marketplaceOpen = useSessionStore((s) => s.marketplaceOpen)
  const addAttachments = useSessionStore((s) => s.addAttachments)
  const setExpandedUI = useThemeStore((s) => s.setExpandedUI)
  const themeMode = useThemeStore((s) => s.themeMode)
  const setThemeMode = useThemeStore((s) => s.setThemeMode)
  const colors = useColors()

  const title = activeTab?.title || (tabs.length > 0 ? 'New Tab' : 'Claude Code')
  const activeStatus = activeTab?.status
  const hasPermission = (activeTab?.permissionQueue?.length ?? 0) > 0
  const isRunning = activeStatus === 'running' || activeStatus === 'connecting'

  const handleMaximize = useCallback(() => {
    // Ensure expanded so SettingsPopover/HistoryPicker open downward in maximal mode
    if (!isExpanded) toggleExpanded()
    setExpandedUI(true)
    try { window.clui.setWindowWidth(820) } catch {}
  }, [setExpandedUI, isExpanded, toggleExpanded])

  const handleThemeToggle = useCallback(() => {
    setThemeMode(themeMode === 'dark' ? 'light' : 'dark')
  }, [themeMode, setThemeMode])

  const handleWip = useCallback(() => {
    alert('This feature is coming soon!')
  }, [])

  const handleScreenshot = useCallback(async () => {
    const result = await window.clui.takeScreenshot()
    if (result) addAttachments([result])
  }, [addAttachments])

  const handleAttach = useCallback(async () => {
    const files = await window.clui.attachFiles()
    if (files?.length) addAttachments(files)
  }, [addAttachments])

  return (
    <div data-clui-ui style={{ position: 'relative', marginBottom: 10 }}>

      {/* Marketplace overlay (above mini player) */}
      <AnimatePresence>
        {marketplaceOpen && (
          <motion.div
            data-clui-ui
            className="no-drag"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.985 }}
            transition={TRANSITION}
            style={{ marginBottom: 10 }}
          >
            <div
              data-clui-ui
              className="no-drag"
              style={{
                borderRadius: 16,
                overflow: 'hidden',
                maxHeight: 400,
                background: colors.containerBg,
                border: `1px solid ${colors.containerBorder}`,
                boxShadow: colors.cardShadow,
              }}
            >
              <MarketplacePanel />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Top bar pill ─── */}
      <div
        data-clui-ui
        className="drag-region"
        style={{
          height: 56,
          borderRadius: isExpanded ? '14px 14px 0 0' : 14,
          background: colors.containerBg,
          border: `1px solid ${colors.containerBorder}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 8px 0 16px',
          boxShadow: isExpanded ? 'none' : colors.cardShadow,
          transition: 'border-radius 0.22s cubic-bezier(0.4, 0, 0.1, 1), box-shadow 0.22s',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {/* C badge */}
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            background: colors.accent,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 700, lineHeight: 1 }}>C</span>
        </div>

        {/* Status dot + Title — click to expand/collapse */}
        <div
          className="no-drag"
          onClick={toggleExpanded}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden',
            cursor: 'pointer',
            minWidth: 0,
          }}
        >
          <MiniStatusDot status={activeStatus} hasPermission={hasPermission} />
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: colors.textPrimary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </span>
        </div>

        {/* Icon row */}
        <div className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <TitleBarBtn title="Maximize view" onClick={handleMaximize}>
            <ArrowsOut size={16} />
          </TitleBarBtn>
          <TitleBarBtn title={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={handleThemeToggle}>
            <Sun size={16} />
          </TitleBarBtn>
          <TitleBarBtn title="Settings (coming soon)" onClick={handleWip}>
            <Gear size={16} />
          </TitleBarBtn>
          <TitleBarBtn title="New tab" onClick={() => void createTab()}>
            <Plus size={16} />
          </TitleBarBtn>
          <TitleBarBtn title={isExpanded ? 'Collapse' : 'Expand input'} onClick={toggleExpanded}>
            {isExpanded ? <CaretUp size={16} /> : <CaretDown size={16} />}
          </TitleBarBtn>
        </div>
      </div>

      {/* ─── Swing-out panel (expanded state) ─── */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            data-clui-ui
            className="no-drag"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={TRANSITION}
            style={{ overflow: 'hidden' }}
          >
            <div
              style={{
                background: colors.containerBg,
                border: `1px solid ${colors.containerBorder}`,
                borderTop: 'none',
                borderRadius: '0 0 14px 14px',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                boxShadow: colors.cardShadow,
              }}
            >
              {/* Input row */}
              <div
                style={{
                  background: colors.inputPillBg,
                  border: `1px solid ${colors.containerBorder}`,
                  borderRadius: 12,
                  minHeight: 50,
                  padding: '0 6px 0 16px',
                }}
              >
                <InputBar />
              </div>

              {/* Action row */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <ActionCircle
                  title="Skills & Plugins"
                  onClick={() => useSessionStore.getState().toggleMarketplace()}
                  disabled={isRunning}
                >
                  <Sparkle size={18} />
                </ActionCircle>
                <ActionCircle title="Take screenshot" onClick={handleScreenshot} disabled={isRunning}>
                  <Camera size={18} />
                </ActionCircle>
                <ActionCircle title="Attach file" onClick={handleAttach} disabled={isRunning}>
                  <Paperclip size={18} />
                </ActionCircle>
                {/* History — reuse existing HistoryPicker in a circle wrapper */}
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: colors.surfacePrimary,
                  }}
                >
                  <HistoryPicker />
                </div>
                <ActionCircle title="New tab" onClick={() => void createTab()}>
                  <Plus size={18} />
                </ActionCircle>
              </div>

              {/* Status row */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <ModelBadge />
                <PermissionBadge />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
