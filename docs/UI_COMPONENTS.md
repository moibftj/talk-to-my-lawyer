# UI Components Documentation

**Last Updated**: February 14, 2026  
**Status**: Production Ready

---

## Overview

This document describes the modern UI components used in the Talk-to-My-Lawyer application, including design patterns, animation strategies, and mobile responsiveness.

---

## Design System

### Core Technologies
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Re-usable component library built on Radix UI
- **Framer Motion**: Animation library for smooth transitions and micro-interactions
- **Lucide React**: Modern icon library with consistent styling

### Design Principles
1. **Professional & Modern**: Clean, polished interfaces that inspire trust
2. **Mobile-First**: Responsive design optimized for all screen sizes
3. **Accessible**: WCAG 2.1 AA compliant with proper ARIA labels
4. **Performant**: Optimized animations and lazy loading
5. **Consistent**: Unified design language across all screens

---

## Letter Type Selector Component

### Location
`/components/letter-type-selector.tsx`

### Description
A modern, animated card-based selector for choosing letter types. Features glassmorphic design, gradient backgrounds, and smooth Framer Motion animations.

### Features
- ✅ **6 Letter Types**: Demand Letter, Cease & Desist, Contract Breach, Eviction Notice, Employment Dispute, Consumer Complaint
- ✅ **Unique Icons**: Professional Lucide React icons for each type
- ✅ **Gradient Backgrounds**: Distinct color schemes per letter type
- ✅ **Animations**: Staggered fade-in, hover scale, icon rotation on select
- ✅ **Responsive Grid**: 1 column (mobile), 2 columns (tablet), 3 columns (desktop)
- ✅ **Selected State**: Animated checkmark indicator

### Usage

```tsx
import { LetterTypeSelector } from '@/components/letter-type-selector'

export default function NewLetterPage() {
  const [selectedType, setSelectedType] = useState<string | null>(null)
  
  return (
    <LetterTypeSelector
      selectedType={selectedType}
      onSelect={setSelectedType}
    />
  )
}
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `selectedType` | `string \| null` | Yes | Currently selected letter type |
| `onSelect` | `(type: string) => void` | Yes | Callback when a type is selected |

### Letter Type Definitions

```typescript
export const LETTER_TYPES = [
  {
    id: 'demand-letter',
    title: 'Demand Letter',
    description: 'Formal demand for payment or action',
    icon: FileText,
    gradient: 'from-blue-500 to-cyan-500'
  },
  {
    id: 'cease-and-desist',
    title: 'Cease and Desist',
    description: 'Stop harmful or illegal activity',
    icon: Ban,
    gradient: 'from-red-500 to-orange-500'
  },
  {
    id: 'contract-breach',
    title: 'Contract Breach',
    description: 'Address violation of agreement',
    icon: FileCheck,
    gradient: 'from-purple-500 to-pink-500'
  },
  {
    id: 'eviction-notice',
    title: 'Eviction Notice',
    description: 'Formal notice to vacate property',
    icon: Home,
    gradient: 'from-amber-500 to-yellow-500'
  },
  {
    id: 'employment-dispute',
    title: 'Employment Dispute',
    description: 'Workplace or labor issue',
    icon: Briefcase,
    gradient: 'from-green-500 to-emerald-500'
  },
  {
    id: 'consumer-complaint',
    title: 'Consumer Complaint',
    description: 'Product or service issue',
    icon: ShoppingCart,
    gradient: 'from-indigo-500 to-violet-500'
  }
]
```

### Animation Patterns

#### Container Animation
```typescript
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1  // Stagger child animations by 100ms
    }
  }
}
```

#### Card Animation
```typescript
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 15
    }
  }
}
```

#### Hover & Selection
```typescript
whileHover={{ scale: 1.02, y: -4 }}
whileTap={{ scale: 0.98 }}
```

### Styling

#### Card Base Styles
```css
.letter-card-base {
  @apply relative overflow-hidden rounded-2xl border border-gray-200 
         bg-white p-6 shadow-lg transition-all duration-300 
         hover:shadow-2xl cursor-pointer;
}
```

#### Selected State
```css
.letter-card-selected {
  @apply ring-4 ring-blue-500 ring-opacity-50 border-blue-500;
}
```

#### Gradient Overlay
```css
.gradient-overlay {
  @apply absolute inset-0 opacity-10 bg-gradient-to-br;
}
```

### Mobile Responsiveness

| Breakpoint | Grid Columns | Card Padding | Icon Size |
|------------|--------------|--------------|-----------|
| `< 640px` | 1 | `p-4` | `h-10 w-10` |
| `640px - 1024px` | 2 | `p-5` | `h-12 w-12` |
| `> 1024px` | 3 | `p-6` | `h-14 w-14` |

---

## File Upload Component

### Location
`/components/ui/file-upload.tsx`

### Description
Drag-and-drop file upload component with preview, validation, and progress tracking.

### Features
- ✅ **Drag & Drop**: Visual dropzone with hover states
- ✅ **File Validation**: Type and size restrictions
- ✅ **Preview**: Thumbnail previews for images
- ✅ **Multi-file**: Upload up to 5 files
- ✅ **Progress**: Upload progress indicator
- ✅ **Error Handling**: Clear error messages

### Supported File Types
- PDF (`.pdf`)
- Word Documents (`.doc`, `.docx`)
- Excel Spreadsheets (`.xls`, `.xlsx`)
- Images (`.jpg`, `.jpeg`, `.png`, `.gif`)

### Size Limits
- **Max file size**: 10 MB per file
- **Max total files**: 5 files

---

## Form Components

### Location
`/components/ui/` (various form components)

### Components
- **Input**: Text input with label and error states
- **Textarea**: Multi-line text input
- **Select**: Dropdown selector
- **Checkbox**: Boolean input
- **Radio Group**: Single-choice selector
- **Date Picker**: Calendar-based date selection

### Form Validation
All forms use `react-hook-form` with `zod` schema validation:

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

const schema = z.object({
  senderName: z.string().min(2, 'Name must be at least 2 characters'),
  senderEmail: z.string().email('Invalid email address'),
  // ... other fields
})

const form = useForm({
  resolver: zodResolver(schema)
})
```

---

## Animation Best Practices

### 1. Use Semantic Variants
```typescript
const variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
}
```

### 2. Stagger Children for Lists
```typescript
<motion.div variants={containerVariants} initial="hidden" animate="visible">
  {items.map(item => (
    <motion.div key={item.id} variants={itemVariants}>
      {item.content}
    </motion.div>
  ))}
</motion.div>
```

### 3. Optimize Performance
```typescript
// Use layoutId for smooth transitions between states
<motion.div layoutId="card-1" />

// Use will-change for GPU acceleration
<motion.div style={{ willChange: 'transform' }} />
```

### 4. Respect User Preferences
```typescript
import { useReducedMotion } from 'framer-motion'

const shouldReduceMotion = useReducedMotion()
const transition = shouldReduceMotion ? { duration: 0 } : { type: 'spring' }
```

---

## Accessibility Guidelines

### 1. Keyboard Navigation
- All interactive elements must be keyboard accessible
- Use `tabIndex` appropriately
- Provide visible focus indicators

### 2. Screen Reader Support
```tsx
<button aria-label="Select Demand Letter type">
  <FileText aria-hidden="true" />
  <span>Demand Letter</span>
</button>
```

### 3. Color Contrast
- Text must have at least 4.5:1 contrast ratio
- Interactive elements must have at least 3:1 contrast ratio
- Don't rely solely on color to convey information

### 4. Focus Management
```tsx
import { useRef, useEffect } from 'react'

const firstInputRef = useRef<HTMLInputElement>(null)

useEffect(() => {
  firstInputRef.current?.focus()
}, [])
```

---

## Testing

### Component Tests
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { LetterTypeSelector } from './letter-type-selector'

describe('LetterTypeSelector', () => {
  it('renders all letter types', () => {
    render(<LetterTypeSelector selectedType={null} onSelect={jest.fn()} />)
    expect(screen.getByText('Demand Letter')).toBeInTheDocument()
    expect(screen.getByText('Cease and Desist')).toBeInTheDocument()
  })
  
  it('calls onSelect when a type is clicked', () => {
    const onSelect = jest.fn()
    render(<LetterTypeSelector selectedType={null} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Demand Letter'))
    expect(onSelect).toHaveBeenCalledWith('demand-letter')
  })
})
```

---

## Future Enhancements

### Planned Features
- [ ] Dark mode support
- [ ] Custom theme configuration
- [ ] Additional letter type templates
- [ ] Advanced animation presets
- [ ] Component playground/storybook

### Performance Optimizations
- [ ] Lazy load heavy components
- [ ] Implement virtual scrolling for large lists
- [ ] Optimize bundle size with tree-shaking
- [ ] Add service worker for offline support

---

## References

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com)
- [Framer Motion API](https://www.framer.com/motion/)
- [Lucide React Icons](https://lucide.dev)
- [React Hook Form](https://react-hook-form.com)
- [Zod Validation](https://zod.dev)
