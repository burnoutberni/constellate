/**
 * Design System Tokens
 *
 * Centralized design tokens for the Constellate application.
 * These tokens define the visual language and ensure consistency
 * across all components and pages.
 */

// ============================================================================
// Color Palette
// ============================================================================

/**
 * Primary color palette - Blue tones for main actions and branding
 */
const primaryColors = {
	50: '#f0f9ff',
	100: '#e0f2fe',
	200: '#bae6fd',
	300: '#7dd3fc',
	400: '#38bdf8',
	500: '#0ea5e9',
	600: '#0284c7',
	700: '#0369a1',
	800: '#075985',
	900: '#0c4a6e',
	950: '#082f49',
} as const

/**
 * Secondary color palette - Purple/Accent tones for highlights
 */
const secondaryColors = {
	50: '#fdf4ff',
	100: '#fae8ff',
	200: '#f5d0fe',
	300: '#f0abfc',
	400: '#e879f9',
	500: '#d946ef',
	600: '#c026d3',
	700: '#a21caf',
	800: '#86198f',
	900: '#701a75',
	950: '#4a044e',
} as const

/**
 * Neutral color palette - Grays for text, backgrounds, and borders
 */
const neutralColors = {
	50: '#f9fafb',
	100: '#f3f4f6',
	200: '#e5e7eb',
	300: '#d1d5db',
	400: '#9ca3af',
	500: '#6b7280',
	600: '#4b5563',
	700: '#374151',
	800: '#1f2937',
	900: '#111827',
	950: '#030712',
} as const

/**
 * Semantic colors - Success, Warning, Error, Info
 */
const semanticColors = {
	success: {
		50: '#f0fdf4',
		100: '#dcfce7',
		200: '#bbf7d0',
		300: '#86efac',
		400: '#4ade80',
		500: '#22c55e',
		600: '#16a34a',
		700: '#15803d',
		800: '#166534',
		900: '#14532d',
		950: '#052e16',
	},
	warning: {
		50: '#fffbeb',
		100: '#fef3c7',
		200: '#fde68a',
		300: '#fcd34d',
		400: '#fbbf24',
		500: '#f59e0b',
		600: '#d97706',
		700: '#b45309',
		800: '#92400e',
		900: '#78350f',
		950: '#451a03',
	},
	error: {
		50: '#fef2f2',
		100: '#fee2e2',
		200: '#fecaca',
		300: '#fca5a5',
		400: '#f87171',
		500: '#ef4444',
		600: '#dc2626',
		700: '#b91c1c',
		800: '#991b1b',
		900: '#7f1d1d',
		950: '#450a0a',
	},
	info: {
		50: '#eff6ff',
		100: '#dbeafe',
		200: '#bfdbfe',
		300: '#93c5fd',
		400: '#60a5fa',
		500: '#3b82f6',
		600: '#2563eb',
		700: '#1d4ed8',
		800: '#1e40af',
		900: '#1e3a8a',
		950: '#172554',
	},
} as const

/**
 * Light theme color mappings
 */
const lightThemeColors = {
	// Brand colors
	primary: primaryColors,
	secondary: secondaryColors,

	// Neutral colors
	neutral: neutralColors,

	// Semantic colors
	success: semanticColors.success,
	warning: semanticColors.warning,
	error: semanticColors.error,
	info: semanticColors.info,

	// Background colors
	background: {
		primary: '#ffffff',
		secondary: neutralColors[50],
		tertiary: neutralColors[100],
		inverse: neutralColors[900],
	},

	// Text colors
	text: {
		primary: neutralColors[900],
		secondary: neutralColors[700],
		tertiary: neutralColors[600],
		inverse: '#ffffff',
		disabled: neutralColors[400],
		link: primaryColors[600],
		linkHover: primaryColors[700],
	},

	// Border colors
	border: {
		default: neutralColors[200],
		hover: neutralColors[300],
		focus: primaryColors[500],
		error: semanticColors.error[500],
		disabled: neutralColors[200],
	},
} as const

/**
 * Dark theme color mappings
 */
const darkThemeColors = {
	// Brand colors (same as light)
	primary: primaryColors,
	secondary: secondaryColors,

	// Neutral colors (same as light)
	neutral: neutralColors,

	// Semantic colors (same as light)
	success: semanticColors.success,
	warning: semanticColors.warning,
	error: semanticColors.error,
	info: semanticColors.info,

	// Background colors (inverted)
	background: {
		primary: neutralColors[950],
		secondary: neutralColors[900],
		tertiary: neutralColors[800],
		inverse: neutralColors[50],
	},

	// Text colors (inverted)
	text: {
		primary: neutralColors[50],
		secondary: neutralColors[200],
		tertiary: neutralColors[400],
		inverse: neutralColors[900],
		disabled: neutralColors[600],
		link: primaryColors[400],
		linkHover: primaryColors[300],
	},

	// Border colors
	border: {
		default: neutralColors[800],
		hover: neutralColors[700],
		focus: primaryColors[400],
		error: semanticColors.error[500],
		disabled: neutralColors[800],
	},
} as const

// ============================================================================
// Typography
// ============================================================================

/**
 * Font families
 */
const fontFamilies = {
	sans: [
		'Inter',
		'system-ui',
		'-apple-system',
		'BlinkMacSystemFont',
		'Segoe UI',
		'Roboto',
		'sans-serif',
	],
	mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', 'monospace'],
} as const

/**
 * Font sizes
 */
const fontSizes = {
	xs: '0.75rem', // 12px
	sm: '0.875rem', // 14px
	base: '1rem', // 16px
	lg: '1.125rem', // 18px
	xl: '1.25rem', // 20px
	'2xl': '1.5rem', // 24px
	'3xl': '1.875rem', // 30px
	'4xl': '2.25rem', // 36px
	'5xl': '3rem', // 48px
	'6xl': '3.75rem', // 60px
} as const

/**
 * Font weights
 */
const fontWeights = {
	light: 300,
	normal: 400,
	medium: 500,
	semibold: 600,
	bold: 700,
	extrabold: 800,
} as const

/**
 * Line heights
 */
const lineHeights = {
	none: 1,
	tight: 1.25,
	snug: 1.375,
	normal: 1.5,
	relaxed: 1.625,
	loose: 2,
} as const

/**
 * Letter spacing
 */
const letterSpacing = {
	tighter: '-0.05em',
	tight: '-0.025em',
	normal: '0em',
	wide: '0.025em',
	wider: '0.05em',
	widest: '0.1em',
} as const

/**
 * Typography scale - Predefined text styles
 */
const typography = {
	h1: {
		fontSize: fontSizes['5xl'],
		fontWeight: fontWeights.bold,
		lineHeight: lineHeights.tight,
		letterSpacing: letterSpacing.tight,
	},
	h2: {
		fontSize: fontSizes['4xl'],
		fontWeight: fontWeights.bold,
		lineHeight: lineHeights.tight,
		letterSpacing: letterSpacing.tight,
	},
	h3: {
		fontSize: fontSizes['3xl'],
		fontWeight: fontWeights.semibold,
		lineHeight: lineHeights.snug,
		letterSpacing: letterSpacing.tight,
	},
	h4: {
		fontSize: fontSizes['2xl'],
		fontWeight: fontWeights.semibold,
		lineHeight: lineHeights.snug,
		letterSpacing: letterSpacing.normal,
	},
	h5: {
		fontSize: fontSizes.xl,
		fontWeight: fontWeights.medium,
		lineHeight: lineHeights.normal,
		letterSpacing: letterSpacing.normal,
	},
	h6: {
		fontSize: fontSizes.lg,
		fontWeight: fontWeights.medium,
		lineHeight: lineHeights.normal,
		letterSpacing: letterSpacing.normal,
	},
	body: {
		fontSize: fontSizes.base,
		fontWeight: fontWeights.normal,
		lineHeight: lineHeights.relaxed,
		letterSpacing: letterSpacing.normal,
	},
	bodySmall: {
		fontSize: fontSizes.sm,
		fontWeight: fontWeights.normal,
		lineHeight: lineHeights.normal,
		letterSpacing: letterSpacing.normal,
	},
	caption: {
		fontSize: fontSizes.xs,
		fontWeight: fontWeights.normal,
		lineHeight: lineHeights.normal,
		letterSpacing: letterSpacing.wide,
	},
	label: {
		fontSize: fontSizes.sm,
		fontWeight: fontWeights.medium,
		lineHeight: lineHeights.normal,
		letterSpacing: letterSpacing.wide,
	},
} as const

// ============================================================================
// Spacing
// ============================================================================

/**
 * Spacing scale - Consistent spacing units (4px base)
 */
const spacing = {
	0: '0',
	1: '0.25rem', // 4px
	2: '0.5rem', // 8px
	3: '0.75rem', // 12px
	4: '1rem', // 16px
	5: '1.25rem', // 20px
	6: '1.5rem', // 24px
	8: '2rem', // 32px
	10: '2.5rem', // 40px
	12: '3rem', // 48px
	16: '4rem', // 64px
	20: '5rem', // 80px
	24: '6rem', // 96px
	32: '8rem', // 128px
	40: '10rem', // 160px
	48: '12rem', // 192px
	64: '16rem', // 256px
} as const

// ============================================================================
// Border Radius
// ============================================================================

/**
 * Border radius scale
 */
const borderRadius = {
	none: '0',
	sm: '0.125rem', // 2px
	base: '0.25rem', // 4px
	md: '0.375rem', // 6px
	lg: '0.5rem', // 8px
	xl: '0.75rem', // 12px
	'2xl': '1rem', // 16px
	'3xl': '1.5rem', // 24px
	full: '9999px',
} as const

// ============================================================================
// Shadows
// ============================================================================

/**
 * Shadow scale - Elevation system
 */
const shadows = {
	none: 'none',
	xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
	sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
	base: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
	md: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
	lg: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
	xl: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
	'2xl': '0 35px 60px -15px rgb(0 0 0 / 0.3)',
	inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
} as const

/**
 * Dark mode shadows (higher opacity shadows for dark backgrounds)
 */
const darkShadows = {
	none: 'none',
	xs: '0 1px 2px 0 rgb(0 0 0 / 0.3)',
	sm: '0 1px 3px 0 rgb(0 0 0 / 0.4), 0 1px 2px -1px rgb(0 0 0 / 0.4)',
	base: '0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.4)',
	md: '0 10px 15px -3px rgb(0 0 0 / 0.4), 0 4px 6px -4px rgb(0 0 0 / 0.4)',
	lg: '0 20px 25px -5px rgb(0 0 0 / 0.4), 0 8px 10px -6px rgb(0 0 0 / 0.4)',
	xl: '0 25px 50px -12px rgb(0 0 0 / 0.5)',
	'2xl': '0 35px 60px -15px rgb(0 0 0 / 0.6)',
	inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.3)',
} as const

// ============================================================================
// Breakpoints
// ============================================================================

/**
 * Responsive breakpoints
 */
const breakpoints = {
	xs: '0px',
	sm: '640px',
	md: '768px',
	lg: '1024px',
	xl: '1280px',
	'2xl': '1536px',
} as const

// ============================================================================
// Z-Index Scale
// ============================================================================

/**
 * Z-index scale for layering
 */
const zIndex = {
	base: 0,
	dropdown: 1000,
	sticky: 1020,
	fixed: 1030,
	modalBackdrop: 1040,
	modal: 1050,
	popover: 1060,
	tooltip: 1070,
	toast: 1080,
} as const

// ============================================================================
// Transitions
// ============================================================================

/**
 * Transition durations
 */
const transitionDuration = {
	fast: '150ms',
	base: '200ms',
	slow: '300ms',
	slower: '500ms',
} as const

/**
 * Transition timing functions
 */
const transitionTiming = {
	linear: 'linear',
	easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
	easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
	easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const

/**
 * Common transitions
 */
const transitions = {
	default: `${transitionDuration.base} ${transitionTiming.easeInOut}`,
	fast: `${transitionDuration.fast} ${transitionTiming.easeInOut}`,
	slow: `${transitionDuration.slow} ${transitionTiming.easeInOut}`,
} as const

// ============================================================================
// Exports
// ============================================================================

export const tokens = {
	colors: {
		// Color palettes (for Tailwind and direct access)
		primary: primaryColors,
		secondary: secondaryColors,
		neutral: neutralColors,
		semantic: semanticColors,
		// Theme-specific color mappings
		light: lightThemeColors,
		dark: darkThemeColors,
	},
	typography,
	spacing,
	borderRadius,
	shadows: {
		light: shadows,
		dark: darkShadows,
	},
	breakpoints,
	zIndex,
	transitions,
	transitionDuration,
	transitionTiming,
	fontFamilies,
	fontSizes,
	fontWeights,
	lineHeights,
	letterSpacing,
} as const

export type Theme = 'light' | 'dark'
