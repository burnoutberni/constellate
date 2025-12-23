# Design System

This directory contains the design system foundation for the Constellate application, including design tokens, theme management, and type definitions.

## Overview

The design system provides a centralized set of design tokens that ensure visual consistency across the entire application. All colors, typography, spacing, shadows, and other design values are defined here and used throughout the codebase.

## Structure

```
design-system/
├── tokens.ts          # Design tokens (colors, typography, spacing, etc.)
├── types.ts           # TypeScript types for tokens
├── ThemeContext.tsx   # Theme provider and hooks
├── index.ts           # Public API (barrel export)
└── README.md          # This file
```

## Design Tokens

### Colors

The color system includes:

- **Primary colors**: Blue tones for main actions and branding
- **Secondary colors**: Purple/accent tones for highlights
- **Neutral colors**: Grays for text, backgrounds, and borders
- **Semantic colors**: Success, warning, error, and info states

Each color scale includes shades from 50 (lightest) to 950 (darkest).

#### Usage

```typescript
import { tokens } from './design-system'

// Access colors
const primaryColor = tokens.colors.light.primary[500]
const textColor = tokens.colors.light.text.primary
```

#### Tailwind Usage

Colors are automatically available in Tailwind classes:

```tsx
<div className="bg-primary-500 text-primary-900">
  Primary colored element
</div>

<div className="bg-error-100 text-error-700 border-error-500">
  Error state
</div>
```

### Typography

The typography system includes:

- **Font families**: Sans-serif (Inter) and monospace fonts
- **Font sizes**: From `xs` (12px) to `6xl` (60px)
- **Font weights**: Light (300) to extrabold (800)
- **Line heights**: From `none` (1) to `loose` (2)
- **Letter spacing**: From `tighter` to `widest`

#### Predefined Text Styles

The `typography` object provides ready-to-use text styles:

- `h1` through `h6`: Heading styles
- `body`: Default body text
- `bodySmall`: Smaller body text
- `caption`: Caption text
- `label`: Form label text

#### Usage

```typescript
import { tokens } from './design-system'

// Access typography
const headingStyle = tokens.typography.h1
const bodyStyle = tokens.typography.body
```

#### Tailwind Usage

Typography tokens are available in Tailwind:

```tsx
<h1 className="text-5xl font-bold leading-tight tracking-tight">
  Heading
</h1>

<p className="text-base font-normal leading-relaxed">
  Body text
</p>
```

### Spacing

The spacing scale uses a 4px base unit (rem-based):

- `0`: 0
- `1`: 4px (0.25rem)
- `2`: 8px (0.5rem)
- `4`: 16px (1rem)
- `8`: 32px (2rem)
- `16`: 64px (4rem)
- And more...

#### Usage

```typescript
import { tokens } from './design-system'

const padding = tokens.spacing[4] // '1rem'
```

#### Tailwind Usage

Spacing is available in Tailwind's spacing utilities:

```tsx
<div className="p-4 m-8 gap-2">Spaced content</div>
```

### Border Radius

Border radius values for rounded corners:

- `none`: 0
- `sm`: 2px
- `base`: 4px
- `md`: 6px
- `lg`: 8px
- `xl`: 12px
- `2xl`: 16px
- `3xl`: 24px
- `full`: 9999px (fully rounded)

#### Usage

```tsx
<div className="rounded-lg">Rounded corners</div>
<div className="rounded-full">Circle</div>
```

### Shadows

Shadow scale for elevation:

- `none`: No shadow
- `xs`: Subtle shadow
- `sm`: Small shadow
- `base`: Default shadow
- `md`: Medium shadow
- `lg`: Large shadow
- `xl`: Extra large shadow
- `2xl`: 2x extra large shadow
- `inner`: Inset shadow

#### Usage

```tsx
<div className="shadow-md">Elevated card</div>
<div className="shadow-lg hover:shadow-xl">Interactive card</div>
```

### Breakpoints

Responsive breakpoints for media queries:

- `xs`: 0px
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

#### Usage

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">Responsive grid</div>
```

### Z-Index

Z-index scale for layering:

- `base`: 0
- `dropdown`: 1000
- `sticky`: 1020
- `fixed`: 1030
- `modalBackdrop`: 1040
- `modal`: 1050
- `popover`: 1060
- `tooltip`: 1070
- `toast`: 1080

#### Usage

```tsx
<div className="z-modal">Modal content</div>
```

## Theme System

The design system supports light and dark themes. The theme is managed through the `ThemeProvider` and `useTheme` hook.

### Setup

Wrap your application with `ThemeProvider`:

```tsx
import { ThemeProvider } from './design-system'

function App() {
	return <ThemeProvider>{/* Your app */}</ThemeProvider>
}
```

### Using the Theme Hook

```tsx
import { useTheme } from './design-system'

function MyComponent() {
	const { theme, setTheme, toggleTheme } = useTheme()

	return <button onClick={toggleTheme}>Current theme: {theme}</button>
}
```

### Theme Persistence

The theme preference is automatically saved to `localStorage` and persists across page reloads.

### System Preference Detection

The theme system automatically detects the user's system preference (light/dark mode) and uses it as the default if no explicit preference is stored.

### Theme-Aware Colors

Colors automatically adapt to the current theme:

```tsx
// These classes automatically use the correct theme colors
<div className="bg-background-primary text-text-primary">Theme-aware content</div>
```

For programmatic access:

```tsx
import { useThemeColors } from './design-system'

function MyComponent() {
	const colors = useThemeColors()

	return <div style={{ color: colors.text.primary }}>Themed text</div>
}
```

## TypeScript Types

The design system includes comprehensive TypeScript types for type safety:

```typescript
import type {
	Theme,
	ThemeColors,
	TypographyStyle,
	SpacingValue,
	BorderRadiusValue,
	ShadowValue,
	// ... and more
} from './design-system'
```

### Type Validation

Helper functions are available to validate token values:

```typescript
import { isValidTheme } from './design-system'

if (isValidTheme(value)) {
	// value is a valid theme ('LIGHT' or 'DARK')
}
```

## Best Practices

### 1. Use Tokens, Not Hardcoded Values

❌ **Don't:**

```tsx
<div style={{ padding: '16px', color: '#0ea5e9' }}>
```

✅ **Do:**

```tsx
<div className="p-4 text-primary-500">
```

Or with tokens:

```tsx
import { tokens } from './design-system'
<div style={{
  padding: tokens.spacing[4],
  color: tokens.colors.light.primary[500]
}}>
```

### 2. Use Semantic Color Names

❌ **Don't:**

```tsx
<div className="bg-red-500">Error message</div>
```

✅ **Do:**

```tsx
<div className="bg-error-500">Error message</div>
```

### 3. Use Typography Styles

❌ **Don't:**

```tsx
<h1 style={{ fontSize: '3rem', fontWeight: 700 }}>
```

✅ **Do:**

```tsx
<h1 className="text-5xl font-bold">
```

### 4. Use Spacing Scale

❌ **Don't:**

```tsx
<div style={{ margin: '13px', padding: '7px' }}>
```

✅ **Do:**

```tsx
<div className="m-3 p-2">
```

### 5. Theme-Aware Components

Always design components to work in both light and dark themes:

```tsx
function Card({ children }) {
	return (
		<div className="bg-background-primary text-text-primary border-border-default rounded-lg shadow-md">
			{children}
		</div>
	)
}
```

## Integration with Tailwind

All design tokens are automatically integrated with Tailwind CSS through `tailwind.config.ts`. This means you can use tokens both:

1. **Via Tailwind classes** (recommended for most cases):

    ```tsx
    <div className="bg-primary-500 p-4 rounded-lg shadow-md">
    ```

2. **Via token imports** (for dynamic values):
    ```tsx
    import { tokens } from './design-system'
    <div style={{ backgroundColor: tokens.colors.light.primary[500] }}>
    ```

## Testing

See `tokens.test.ts` for examples of testing token validation and type safety.

## Future Enhancements

- [ ] Add more semantic color variants
- [ ] Expand typography scale
- [ ] Add animation tokens
- [ ] Add component-specific tokens
- [ ] Add design system documentation site (Storybook)

## Related Documentation

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Design Tokens Specification](https://tr.designtokens.org/format/)
