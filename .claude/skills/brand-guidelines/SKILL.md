---
name: brand-guidelines
description: Assure DeFi brand rules, design tokens, and UI patterns. Use when creating UI components, styling elements, working with colors, or doing any front-end work. Keywords: button, component, style, color, UI, UX, design, brand, dashboard, form, modal.
---

# Assure DeFi Brand Guidelines

## Brand Identity

**Pillars**: Integrity, Trust, Credibility
**Ethos**: "Trust, but verify"
**Tone**: Serious, professional, high-trust. No playful or consumer-style UI.

## Color Palette (STRICT - No Other Colors Allowed)

| Name | Hex | CSS Variable | Usage |
|------|-----|--------------|-------|
| Navy | #0A0724 | `--background` | Primary background |
| Gold | #E2D243 | `--primary`, `--accent` | CTAs, highlights, accents |
| Light Grey | #F2F2F2 | `--foreground`, `--text-secondary` | Text, secondary elements |
| White | #FFFFFF | `--text-primary` | Primary text on dark |
| Black | #000000 | `--surface` | Card backgrounds, surfaces |

## Semantic Colors

```json
{
  "background": "#0A0724",
  "surface": "#000000",
  "textPrimary": "#FFFFFF",
  "textSecondary": "#F2F2F2",
  "accent": "#E2D243",
  "border": "rgba(242,242,242,0.15)"
}
```

## Typography

- **Primary Font**: Inter (always)
- **Headings**: Inter 600-700 weight
- **Body**: Inter 400 weight
- **UI Labels**: Inter 500 weight

## Border Radius

- Small: 6px (`rounded-md`)
- Medium: 10px (`rounded-lg`)
- Large: 14px (`rounded-xl`)

**NEVER use `rounded-full` for buttons** - this creates pill shapes.

## DO NOT Rules (Violations Are Unacceptable)

1. **DO NOT** introduce colors outside the brand palette
2. **DO NOT** use gradients unless explicitly requested
3. **DO NOT** use emojis in UI
4. **DO NOT** use pill-shaped buttons (`rounded-full`)
5. **DO NOT** add decorative animations
6. **DO NOT** change logo proportions or colors
7. **DO NOT** use light-mode as default (dark-mode first)

## Button Patterns

### Correct Implementation

```tsx
// Primary action button - uses gold accent
<Button variant="default">Approve Article</Button>

// Secondary/outline - gold border, transparent bg
<Button variant="outline">View Details</Button>

// Destructive - for delete/cancel actions
<Button variant="destructive">Reject</Button>

// Ghost - minimal, for tertiary actions
<Button variant="ghost">Cancel</Button>
```

### Existing Button Variants (Use These)

The project already has properly branded button variants in `/src/components/ui/button.tsx`:
- `default` - Gold bg (#E2D243), shadow effect
- `outline` - Gold border, transparent bg
- `secondary` - Light grey border, subtle hover
- `ghost` - No border, subtle hover
- `destructive` - Red/destructive color

### Incorrect (Never Do This)

```tsx
// WRONG - introduces non-brand color
<button className="bg-blue-500">Submit</button>

// WRONG - pill shape
<button className="rounded-full">Click</button>

// WRONG - gradient
<button className="bg-gradient-to-r from-yellow-400 to-orange-500">Action</button>

// WRONG - bounce animation
<button className="animate-bounce">Notice Me</button>
```

## Card/Surface Patterns

```tsx
// Correct - uses brand colors
<div className="bg-black border border-[rgba(242,242,242,0.15)] rounded-lg p-6">
  <h3 className="text-white font-semibold">Card Title</h3>
  <p className="text-[#F2F2F2]">Card content</p>
</div>
```

## Form Input Patterns

```tsx
// Correct - dark mode, brand borders
<input
  className="bg-black border border-[rgba(242,242,242,0.15)] rounded-lg px-4 py-2 text-white placeholder:text-[#F2F2F2]/50 focus:border-[#E2D243] focus:ring-1 focus:ring-[#E2D243]"
/>
```

## Status/Alert Colors

For status indicators, map to brand colors:
- **Success**: Gold (#E2D243) - represents verified/approved
- **Error**: Use `destructive` variant (red is acceptable for errors)
- **Info**: Light grey (#F2F2F2) on navy background
- **Warning**: Gold with different context

## Logo Usage

- Use only assets from `/brand/assets/logos`
- Never recolor, stretch, rotate, or add effects
- Maintain clear space around logos
- Primary logo for dark backgrounds: `logo-on-dark.svg`

## Quick Reference

When creating ANY UI element:
1. Background: Navy (#0A0724) or Black (#000000)
2. Primary text: White (#FFFFFF)
3. Secondary text: Light Grey (#F2F2F2)
4. Accent/CTA: Gold (#E2D243)
5. Borders: `rgba(242,242,242,0.15)`
6. Border radius: `rounded-lg` (10px) for most elements
7. Font: Inter (already configured in project)
