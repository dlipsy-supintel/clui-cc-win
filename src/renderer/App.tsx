import React, { useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Paperclip, Camera, HeadCircuit,
  Sun, Moon,
  ArrowsIn,
} from '@phosphor-icons/react'
import { TabStrip } from './components/TabStrip'
import { ConversationView } from './components/ConversationView'
import { InputBar } from './components/InputBar'
import { StatusBar } from './components/StatusBar'
import { MarketplacePanel } from './components/MarketplacePanel'
import { PopoverLayerProvider } from './components/PopoverLayer'
import { MiniPlayer } from './components/MiniPlayer'
import { useClaudeEvents } from './hooks/useClaudeEvents'
import { useHealthReconciliation } from './hooks/useHealthReconciliation'
import { useSessionStore } from './stores/sessionStore'
import { useColors, useThemeStore, spacing } from './theme'

const TRANSITION = { duration: 0.26, ease: [0.4, 0, 0.1, 1] as const }

export default function App() {
  useClaudeEvents()
  useHealthReconciliation()

  const activeTabStatus = useSessionStore((s) => s.tabs.find((t) => t.id === s.activeTabId)?.status)
  const addAttachments = useSessionStore((s) => s.addAttachments)
  const colors = useColors()
  const setSystemTheme = useThemeStore((s) => s.setSystemTheme)
  const expandedUI = useThemeStore((s) => s.expandedUI)
  const setExpandedUI = useThemeStore((s) => s.setExpandedUI)

  // ─── Theme initialization ───
  useEffect(() => {
    window.clui.getTheme().then(({ isDark }) => {
      setSystemTheme(isDark)
    }).catch(() => {})

    const unsub = window.clui.onThemeChange((isDark) => {
      setSystemTheme(isDark)
    })
    return unsub
  }, [setSystemTheme])

  useEffect(() => {
    useSessionStore.getState().initStaticInfo().then(() => {
      const homeDir = useSessionStore.getState().staticInfo?.homePath || '~'
      const tab = useSessionStore.getState().tabs[0]
      if (tab) {
        useSessionStore.setState((s) => ({
          tabs: s.tabs.map((t, i) => (i === 0 ? { ...t, workingDirectory: homeDir, hasChosenDirectory: false } : t)),
        }))
        window.clui.createTab().then(({ tabId }) => {
          useSessionStore.setState((s) => ({
            tabs: s.tabs.map((t, i) => (i === 0 ? { ...t, id: tabId } : t)),
            activeTabId: tabId,
          }))
        }).catch(() => {})
      }
    })
  }, [])

  // OS-level click-through
  useEffect(() => {
    if (!window.clui?.setIgnoreMouseEvents) return
    let lastIgnored: boolean | null = null

    const onMouseMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const isUI = !!(el && el.closest('[data-clui-ui]'))
      const shouldIgnore = !isUI
      if (shouldIgnore !== lastIgnored) {
        lastIgnored = shouldIgnore
        if (shouldIgnore) {
          window.clui.setIgnoreMouseEvents(true, { forward: true })
        } else {
          window.clui.setIgnoreMouseEvents(false)
        }
      }
    }

    const onMouseLeave = () => {
      if (lastIgnored !== true) {
        lastIgnored = true
        window.clui.setIgnoreMouseEvents(true, { forward: true })
      }
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseleave', onMouseLeave)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  const isExpanded = useSessionStore((s) => s.isExpanded)
  const marketplaceOpen = useSessionStore((s) => s.marketplaceOpen)
  const isRunning = activeTabStatus === 'running' || activeTabStatus === 'connecting'

  const handleScreenshot = useCallback(async () => {
    const result = await window.clui.takeScreenshot()
    if (!result) return
    addAttachments([result])
  }, [addAttachments])

  const handleAttachFile = useCallback(async () => {
    const files = await window.clui.attachFiles()
    if (!files || files.length === 0) return
    addAttachments(files)
  }, [addAttachments])

  const handleMinimize = useCallback(() => {
    setExpandedUI(false)
    try { window.clui.setWindowWidth(spacing.contentWidth) } catch {}
  }, [setExpandedUI])

  // ─── MINI MODE ───
  if (!expandedUI) {
    return (
      <PopoverLayerProvider>
        <div
          className="flex flex-col justify-end h-full"
          style={{ background: 'transparent' }}
        >
          <div
            style={{
              width: spacing.contentWidth,
              margin: '0 auto',
              position: 'relative',
            }}
          >
            <MiniPlayer />
          </div>
        </div>
      </PopoverLayerProvider>
    )
  }

  // ─── MAXIMAL MODE ───
  const maxWidth = 820

  return (
    <PopoverLayerProvider>
      <div
        data-clui-ui
        className="flex flex-col h-full"
        style={{ background: 'transparent' }}
      >
        <motion.div
          data-clui-ui
          className="flex flex-col"
          style={{
            flex: 1,
            margin: '10px 10px 10px 10px',
            borderRadius: 16,
            overflow: 'hidden',
            background: colors.containerBg,
            border: `1px solid ${colors.containerBorder}`,
            boxShadow: colors.cardShadow,
            display: 'flex',
            flexDirection: 'column',
          }}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={TRANSITION}
        >
          {/* ─── Maximal Title Bar ─── */}
          <MaximalTitleBar onMinimize={handleMinimize} />

          {/* ─── Conversation + Status ─── */}
          <div
            className="no-drag"
            style={{
              flex: 1,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Marketplace panel (overlay inside maximal) */}
            <AnimatePresence>
              {marketplaceOpen && (
                <motion.div
                  data-clui-ui
                  className="no-drag"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={TRANSITION}
                  style={{
                    borderBottom: `1px solid ${colors.containerBorder}`,
                    maxHeight: 400,
                    overflow: 'hidden',
                  }}
                >
                  <MarketplacePanel />
                </motion.div>
              )}
            </AnimatePresence>

            <div style={{ flex: 1, overflow: 'hidden' }}>
              <ConversationView />
              <StatusBar />
            </div>
          </div>

          {/* ─── Bottom Bar ─── */}
          <MaximalBottomBar
            isRunning={isRunning}
            onScreenshot={handleScreenshot}
            onAttach={handleAttachFile}
          />
        </motion.div>
      </div>
    </PopoverLayerProvider>
  )
}

// ─── Maximal Title Bar ───

function MaximalTitleBar({ onMinimize }: { onMinimize: () => void }) {
  const colors = useColors()
  const themeMode = useThemeStore((s) => s.themeMode)
  const setThemeMode = useThemeStore((s) => s.setThemeMode)

  const handleMinimizeWindow = () => {
    try { window.clui.minimizeWindow() } catch {}
  }

  const handleFullScreen = () => {
    try { window.clui.toggleFullScreen() } catch {}
  }

  return (
    <div
      data-clui-ui
      className="drag-region flex items-center"
      style={{
        height: 52,
        background: colors.containerBg,
        borderBottom: `1px solid ${colors.containerBorder}`,
        padding: '0 16px',
        flexShrink: 0,
      }}
    >
      {/* Traffic lights */}
      <div className="no-drag flex items-center gap-2" style={{ marginRight: 12 }}>
        <button
          onClick={() => window.clui.hideWindow()}
          title="Hide window"
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#FF5F57',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'block',
          }}
        />
        <button
          onClick={handleMinimizeWindow}
          title="Minimize"
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#FEBC2E',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'block',
          }}
        />
        <button
          onClick={handleFullScreen}
          title="Toggle full screen"
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: '#28C840',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            display: 'block',
          }}
        />
      </div>

      {/* Tab strip — grows to fill */}
      <div className="no-drag flex-1 min-w-0">
        <TabStrip />
      </div>

      {/* Right actions: theme toggle + minimize */}
      <div className="no-drag flex items-center gap-0.5 flex-shrink-0">
        <button
          onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
          title={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: colors.textTertiary, background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          {themeMode === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <button
          onClick={onMinimize}
          title="Minimize to mini player"
          className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: colors.textTertiary, background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <ArrowsIn size={15} />
        </button>
      </div>
    </div>
  )
}

// ─── Maximal Bottom Bar ───

function MaximalBottomBar({
  isRunning,
  onScreenshot,
  onAttach,
}: {
  isRunning: boolean
  onScreenshot: () => void
  onAttach: () => void
}) {
  const colors = useColors()

  return (
    <div
      data-clui-ui
      className="no-drag"
      style={{
        borderTop: `1px solid ${colors.containerBorder}`,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: colors.containerBg,
        flexShrink: 0,
      }}
    >
      {/* Action circles */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <BottomBarCircle
          title="Attach file"
          onClick={onAttach}
          disabled={isRunning}
        >
          <Paperclip size={17} />
        </BottomBarCircle>
        <BottomBarCircle
          title="Take screenshot"
          onClick={onScreenshot}
          disabled={isRunning}
        >
          <Camera size={17} />
        </BottomBarCircle>
        <BottomBarCircle
          title="Skills & Plugins"
          onClick={() => useSessionStore.getState().toggleMarketplace()}
          disabled={isRunning}
        >
          <HeadCircuit size={17} />
        </BottomBarCircle>
      </div>

      {/* Input pill — grows to fill */}
      <div
        className="flex-1"
        style={{
          background: colors.inputPillBg,
          border: `1px solid ${colors.containerBorder}`,
          borderRadius: 25,
          minHeight: 50,
          padding: '0 6px 0 16px',
        }}
      >
        <InputBar />
      </div>
    </div>
  )
}

function BottomBarCircle({
  onClick,
  title,
  disabled,
  children,
}: {
  onClick: () => void
  title: string
  disabled?: boolean
  children: React.ReactNode
}) {
  const colors = useColors()
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="glass-surface"
      style={{
        width: 46,
        height: 46,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: disabled ? colors.btnDisabled : colors.textTertiary,
        cursor: disabled ? 'default' : 'pointer',
        border: 'none',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}
