import type { Config } from 'tailwindcss'
import { tokens } from './src/design-system/tokens'

/**
 * Tailwind CSS configuration using design system tokens
 */
const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // Colors from design tokens
      colors: {
        primary: tokens.colors.primary,
        secondary: tokens.colors.secondary,
        neutral: tokens.colors.neutral,
        success: tokens.colors.semantic.success,
        warning: tokens.colors.semantic.warning,
        error: tokens.colors.semantic.error,
        info: tokens.colors.semantic.info,
        // Semantic theme colors using CSS variables
        background: {
          primary: 'var(--color-background-primary)',
          secondary: 'var(--color-background-secondary)',
          tertiary: 'var(--color-background-tertiary)',
          inverse: 'var(--color-background-inverse)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
          inverse: 'var(--color-text-inverse)',
          disabled: 'var(--color-text-disabled)',
          link: 'var(--color-text-link)',
          'link-hover': 'var(--color-text-link-hover)',
        },
        border: {
          default: 'var(--color-border-default)',
          hover: 'var(--color-border-hover)',
          focus: 'var(--color-border-focus)',
          error: 'var(--color-border-error)',
          disabled: 'var(--color-border-disabled)',
        },
      },
      
      // Typography from design tokens
      fontFamily: {
        sans: tokens.fontFamilies.sans,
        mono: tokens.fontFamilies.mono,
      },
      fontSize: tokens.fontSizes,
      fontWeight: tokens.fontWeights,
      lineHeight: tokens.lineHeights,
      letterSpacing: tokens.letterSpacing,
      
      // Spacing from design tokens
      spacing: tokens.spacing,
      
      // Border radius from design tokens
      borderRadius: tokens.borderRadius,
      
      // Shadows using CSS variables for theme-aware shadows
      boxShadow: {
        none: 'var(--shadow-none)',
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        base: 'var(--shadow-base)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        '2xl': 'var(--shadow-2xl)',
        inner: 'var(--shadow-inner)',
      },
      
      // Breakpoints from design tokens
      screens: tokens.breakpoints,
      
      // Z-index from design tokens
      zIndex: tokens.zIndex,
      
      // Transitions
      transitionDuration: tokens.transitionDuration,
      transitionTimingFunction: tokens.transitionTiming,
      
      // Existing animations (preserved)
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      gridTemplateColumns: {
        'calendar': 'repeat(7, minmax(0, 1fr))',
      },
    },
  },
  plugins: [],
}

export default config
