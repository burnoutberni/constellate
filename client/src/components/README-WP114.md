# WP-114: Search and Discovery Enhancements - Component Documentation

## Overview
This document describes the new components added for WP-114 to enhance search and discovery features.

## New Components

### 1. AdvancedSearchFilters
**Location:** `client/src/components/AdvancedSearchFilters.tsx`

A comprehensive filter component with collapsible sections that replaces the inline form in SearchPage.

**Features:**
- **Collapsible sections** for better organization:
  - Basic Search (keyword, location)
  - Date Range (presets + custom range picker)
  - Event Details (attendance mode, status)
  - Categories/Tags (with tag management)
- **Active filter counter** in the header
- **Apply and Clear buttons** for filter management
- Uses design system components (Input, Badge, Button)

**UI Structure:**
```
┌─────────────────────────────────────┐
│ Advanced Filters                    │
│ X filters applied / Refine search   │
├─────────────────────────────────────┤
│ ▼ Basic Search                      │
│   - Keyword input                   │
│   - Location input                  │
├─────────────────────────────────────┤
│ ▼ Date Range                        │
│   - Dropdown (Today, Tomorrow, etc) │
│   - Custom date inputs (if custom)  │
├─────────────────────────────────────┤
│ ▼ Event Details                     │
│   - Attendance mode dropdown        │
│   - Status dropdown                 │
├─────────────────────────────────────┤
│ ▼ Categories / Tags                 │
│   - Tag input (press Enter to add)  │
│   - Tag badges with X to remove     │
├─────────────────────────────────────┤
│ [Apply Filters]  [Clear]            │
└─────────────────────────────────────┘
```

### 2. TrendingEvents
**Location:** `client/src/components/TrendingEvents.tsx`

Displays trending events in a sidebar widget, integrating with the WP-012 backend feature.

**Features:**
- Shows top N trending events (default: 5)
- Displays event title, date, location, and tags
- Shows engagement count (🔥 icon with likes + comments + attendance)
- Configurable time window (default: 7 days)
- "View all events →" link at bottom
- Shown to **unauthenticated users**

**UI Structure:**
```
┌─────────────────────────────────────┐
│ 🔥 Trending Events    Last 7 days   │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ Event Title               🔥 42  │ │
│ │ Today • Location               │ │
│ │ #tag1 #tag2                     │ │
│ └─────────────────────────────────┘ │
│ [More events...]                    │
│                                     │
│ View all events →                   │
└─────────────────────────────────────┘
```

### 3. RecommendedEvents
**Location:** `client/src/components/RecommendedEvents.tsx`

Displays personalized event recommendations, integrating with the WP-013 backend feature.

**Features:**
- Shows personalized recommendations (default: 5)
- Displays event title, date, location, and tags
- Shows reason for recommendation (🏷️ Similar interests, 👤 From host you follow, 👥 Friends attending)
- Shows recommendation score (⭐ with numeric value)
- Displays signal count in header
- "Explore more events →" link at bottom
- Shown to **authenticated users only**

**UI Structure:**
```
┌─────────────────────────────────────┐
│ ✨ Recommended for You              │
│ Based on X signals                  │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ Event Title              ⭐ 8.5 │ │
│ │ Tomorrow • Location             │ │
│ │ 🏷️ Similar interests            │ │
│ │ #tag1 #tag2                     │ │
│ └─────────────────────────────────┘ │
│ [More events...]                    │
│                                     │
│ Explore more events →               │
└─────────────────────────────────────┘
```

### 4. SearchSuggestions
**Location:** `client/src/components/SearchSuggestions.tsx`

Provides autocomplete suggestions for search input.

**Features:**
- Debounced search (300ms delay)
- Shows popular tags (🏷️) with event counts
- Shows location suggestions (📍)
- Shows recent searches (🕐) from localStorage
- Maximum 5 recent searches stored
- Click to select suggestion
- Export utility functions: `addRecentSearch()`, `clearRecentSearches()`

**UI Structure:**
```
┌─────────────────────────────────────┐
│ Recent Searches                     │
├─────────────────────────────────────┤
│ 🕐 previous search term             │
│ 🏷️ #popular-tag            [42]    │
│ 📍 New York                         │
└─────────────────────────────────────┘
```

## SearchPage Integration

The SearchPage now uses a 2-column layout:

**Desktop Layout (lg:grid-cols-12):**
- **Left Column (4 cols):** AdvancedSearchFilters + TrendingEvents/RecommendedEvents
- **Right Column (8 cols):** Search results with active filter chips

**Key Changes:**
1. Replaced inline form with `AdvancedSearchFilters` component
2. Added `TrendingEvents` in sidebar (for unauthenticated users)
3. Added `RecommendedEvents` in sidebar (for authenticated users)
4. Integrated `addRecentSearch()` to save search queries to localStorage
5. All components use design system components for consistency

## Testing

Each component has a basic test file:
- `TrendingEvents.test.tsx`
- `RecommendedEvents.test.tsx`
- `SearchSuggestions.test.tsx`
- `AdvancedSearchFilters.test.tsx`

All tests pass with 10/10 test cases.

## Design System Usage

All components follow the design system and use:
- `Button` component (with variants: primary, ghost)
- `Badge` component (with variants: default, primary)
- `Card` component (for container styling)
- `Input` component (for form inputs)
- Design tokens for colors and spacing

## Backend Integration

- **TrendingEvents:** Uses `useTrendingEvents(limit, windowDays)` hook → `/api/events/trending`
- **RecommendedEvents:** Uses `useRecommendedEvents(limit)` hook → `/api/recommendations`
- **SearchSuggestions:** Fetches from `/api/search/suggestions?q=...` (with fallback to recent searches)

## Search History

Search history is persisted in localStorage:
- Key: `constellate_recent_searches`
- Max entries: 5
- Stored as JSON array of strings
- Updated on search submission via `addRecentSearch()`
