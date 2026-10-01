// Keeps a demo running: if one page fails to render, show a calm recovery card instead of a blank screen
import React from 'react'
import { useStore } from '../store/useStore'

export class PageErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error) { console.error('[COIN] page error', error) }
  render() {
    if (!this.state.error) return this.props.children
    const retry = () => this.setState({ error: null })
    const reset = () => { useStore.getState().resetDemo(); this.setState({ error: null }) }
    return (
      <div className="max-w-[520px] mx-auto mt-16 card p-6 text-center">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-brand-grad text-white grid place-items-center text-[20px] font-bold">!</div>
        <h2 className="mt-4 text-[17px] font-bold text-ink">This page couldn't load</h2>
        <p className="mt-1 text-[13px] text-muted">Your data is safe. Try again, go back to the dashboard, or reset the demo data to the original seed.</p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <button onClick={retry} className="h-9 px-4 rounded-lg bg-brand-grad text-white text-[13px] font-semibold">Try again</button>
          <a href="/" className="h-9 px-4 rounded-lg border border-line bg-white text-[13px] font-semibold text-ink-2 grid place-items-center">Dashboard</a>
          <button onClick={reset} className="h-9 px-4 rounded-lg border border-line bg-white text-[13px] font-semibold text-ink-2">Reset demo data</button>
        </div>
      </div>
    )
  }
}
