/** Single source of truth for app-wide constants. */

export const APP_NAME = 'Octop Web'

export const APP_TAGLINE = 'Projects, agents and chat on Supabase'

/**
 * Field limits enforced in the UI. The Edge Function repeats the message limit
 * server side - the browser copy is there to give immediate feedback, not to
 * provide the guarantee.
 */
export const LIMITS = {
  projectName: 100,
  agentName: 100,
  description: 1000,
  systemPrompt: 10000,
  chatMessage: 20000,
  /** Supabase requires at least 6; the spec asks for 8. */
  passwordMin: 8,
} as const

/** Longest auto-generated conversation title, in characters. */
export const TITLE_MAX_LENGTH = 40
