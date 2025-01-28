import type { WelcomeSettings } from '@prisma/client'

// <GuildID, WelcomeSettings>
export const welcomeCache = new Map<string, WelcomeSettings | null>()
