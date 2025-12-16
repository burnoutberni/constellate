# Frontend Pre-Launch Work Packages

This document outlines all remaining frontend work packages needed before launch. Each package can be assigned to an agent for independent implementation.

## Page Reorganization (WP-200 Series)

### WP-200: Homepage Redesign

**Scope:** Refocus homepage on event discovery with marketing elements

**Tasks:**
- Remove calendar widget from HomePage (redirect to `/calendar` for calendar view)
- Add hero section explaining Constellate (what it is, self-hosting mention)
- Show relevant events in sections:
  - Location-based events (if location available)
  - Trending events
  - Upcoming events (soonest first)
  - Recommended events (if authenticated)
- Add platform statistics display
- Add strategic sign-up CTAs
- Add link to About page for self-hosting details

**Files:**
- `client/src/pages/HomePage.tsx` - Major refactor
- `client/src/components/HomeHero.tsx` - Enhance with self-hosting info

**Tests:** Homepage rendering, event sections display, CTAs work

---

### WP-201: Merge Search and Discovery Pages

**Scope:** Combine SearchPage and EventDiscoveryPage into single `/discover` page

**Tasks:**
- Create new `DiscoverPage.tsx` combining best features from both pages
- Include advanced search filters
- Include grid/list view toggle
- Include sorting options (date, popularity, trending)
- Include pagination
- Update routes: `/search` and `/events` redirect to `/discover`
- Update navigation to use "Discover" instead of "Search"
- Update SearchBar to navigate to `/discover`
- Delete old `SearchPage.tsx` and `EventDiscoveryPage.tsx` after migration

**Files:**
- `client/src/pages/DiscoverPage.tsx` (new)
- `client/src/App.tsx` - Add `/discover` route, redirects
- `client/src/lib/navigation.ts` - Update nav links
- `client/src/components/SearchBar.tsx` - Update navigation
- Delete: `client/src/pages/SearchPage.tsx`
- Delete: `client/src/pages/EventDiscoveryPage.tsx`

**Tests:** Search functionality, filters, pagination, route redirects

---

### WP-202: About Page Enhancement

**Scope:** Better integrate About page with self-hosting and WordPress plugin info

**Tasks:**
- Enhance About page with detailed self-hosting information
- Add section about running your own instance
- Add conceptual section about future WordPress plugin integration
- Add link in footer
- Consider adding to navbar (less prominent) or keep in footer

**Files:**
- `client/src/pages/AboutPage.tsx` - Major enhancement
- Create or enhance footer component with About link
- `client/src/components/Navbar.tsx` - Optional About link

**Tests:** About page content, footer links, navigation

---

### WP-203: Dark Mode Toggle Relocation

**Scope:** Move dark mode toggle from navbar to settings page

**Tasks:**
- Remove ThemeToggle from Navbar
- Add theme settings section to SettingsPage
- Include dark mode toggle in settings
- Optionally add system preference detection UI

**Files:**
- `client/src/components/Navbar.tsx` - Remove ThemeToggle
- `client/src/pages/SettingsPage.tsx` - Add theme settings section
- `client/src/components/ThemeToggle.tsx` - Reuse or create SettingsThemeToggle variant

**Tests:** Theme toggle in settings, theme persistence

---

## Remaining Roadmap Items (WP-121 to WP-132)

### WP-204: Loading States and Skeletons

**Scope:** Implement comprehensive loading states (WP-121 from roadmap)

**Tasks:**
- Create skeleton component library
- Add skeletons for event cards, lists, profiles
- Add loading states for all async operations
- Implement progressive loading for images
- Add loading indicators for forms

**Files:**
- `client/src/components/ui/Skeleton.tsx` (new)
- `client/src/components/EventCardSkeleton.tsx` (new)
- `client/src/components/ProfileSkeleton.tsx` (new)
- `client/src/components/LoadingSpinner.tsx` (new or enhance)

**Tests:** Skeleton rendering, loading state display

---

### WP-205: Error Handling and Boundaries

**Scope:** Implement comprehensive error handling (WP-122 from roadmap)

**Tasks:**
- Create `ErrorBoundary` component (may already exist, enhance if needed)
- Add error pages (404, 500, etc.)
- Create user-friendly error messages
- Add retry mechanisms for failed requests
- Add error reporting/logging
- Create error toast notifications

**Files:**
- `client/src/components/ErrorBoundary.tsx` (enhance if exists)
- `client/src/pages/NotFoundPage.tsx` (new)
- `client/src/pages/ErrorPage.tsx` (new)
- `client/src/components/ErrorToast.tsx` (refactor or new)
- `client/src/lib/errorHandling.ts` (enhance)

**Tests:** Error boundary, error pages, retry mechanisms

---

### WP-206: Mobile-First Responsive Design - Core Pages

**Scope:** Ensure all core pages work perfectly on mobile (WP-123 from roadmap)

**Tasks:**
- Audit and fix mobile layouts for:
  - HomePage
  - EventDetailPage
  - DiscoverPage (new)
  - UserProfilePage
- Improve touch targets (minimum 44x44px)
- Optimize images for mobile
- Test on various screen sizes (320px to 768px)
- Ensure proper viewport meta tags

**Files:**
- All page components
- `client/index.html` (viewport meta)

**Tests:** Responsive design, touch interactions, mobile viewport

---

### WP-207: Mobile Navigation and Forms

**Scope:** Optimize navigation and forms for mobile (WP-124 from roadmap)

**Tasks:**
- Create mobile-optimized navigation drawer
- Optimize all forms for mobile (event creation, comments, search)
- Add mobile-friendly date/time pickers
- Improve mobile keyboard handling
- Add swipe gestures where appropriate
- Test on real mobile devices

**Files:**
- `client/src/components/MobileNav.tsx` (refactor)
- All form components
- `client/src/components/MobileDatePicker.tsx` (new)

**Tests:** Mobile navigation, form interactions, gestures

---

### WP-208: Keyboard Navigation and Focus Management

**Scope:** Ensure full keyboard accessibility (WP-125 from roadmap)

**Tasks:**
- Audit all interactive elements for keyboard access
- Add keyboard shortcuts for common actions
- Implement proper focus management
- Add visible focus indicators
- Ensure logical tab order
- Add skip links for main content
- Test with keyboard-only navigation

**Files:**
- All interactive components
- `client/src/lib/keyboardShortcuts.ts` (new)
- `client/src/components/SkipLink.tsx` (new)

**Tests:** Keyboard navigation, focus management, shortcuts

---

### WP-209: ARIA Labels and Semantic HTML

**Scope:** Add comprehensive ARIA support (WP-126 from roadmap)

**Tasks:**
- Audit all components for ARIA labels
- Add proper roles and landmarks
- Improve form labels and error messages
- Add live regions for dynamic content
- Ensure proper heading hierarchy
- Add alt text for all images
- Test with screen readers (NVDA, JAWS, VoiceOver)

**Files:**
- All components
- `client/src/lib/aria.ts` (new for ARIA utilities)

**Tests:** ARIA compliance, screen reader compatibility

---

### WP-210: Dark Mode Full Implementation

**Scope:** Complete dark mode theme support (WP-127 from roadmap)

**Tasks:**
- Create dark mode color scheme using design tokens
- Add theme toggle in settings (WP-203)
- Implement theme persistence (localStorage)
- Update all components for dark mode
- Add system preference detection
- Ensure proper contrast ratios
- Test all pages in dark mode

**Files:**
- `client/src/contexts/ThemeContext.tsx` (enhance)
- `client/src/design-system/tokens.ts` (enhance)
- All components (update for dark mode)
- `client/src/components/ThemeToggle.tsx` (enhance)

**Tests:** Theme switching, contrast ratios, persistence

---

### WP-211: Advanced Search with Map View

**Scope:** Add map-based event discovery (WP-128 from roadmap)

**Tasks:**
- Integrate map library (e.g., Leaflet, Mapbox)
- Create map view for events
- Show events as markers on map
- Add location-based filtering
- Add "Events near me" functionality
- Integrate with location autocomplete
- Make map responsive

**Files:**
- `client/src/components/EventMap.tsx` (new)
- `client/src/pages/MapViewPage.tsx` (new)
- `client/src/components/MapEventMarker.tsx` (new)

**Tests:** Map rendering, marker interactions, location filtering

---

### WP-212: Real-time Updates Enhancement

**Scope:** Enhance real-time features with better UI feedback (WP-129 from roadmap)

**Tasks:**
- Improve SSE connection status display
- Add connection retry logic
- Show real-time update indicators
- Add optimistic UI updates
- Improve real-time notification display
- Add connection status to navbar
- Handle offline/online states

**Files:**
- `client/src/hooks/useRealtimeSSE.ts` (refactor)
- `client/src/components/ConnectionStatus.tsx` (new)
- `client/src/lib/optimisticUpdates.ts` (new)

**Tests:** SSE connection, retry logic, offline handling

---

### WP-213: Admin Panel Redesign

**Scope:** Redesign admin interface (WP-130 from roadmap)

**Tasks:**
- Redesign `AdminPage` with better layout
- Add moderation queue interface
- Add instance settings management
- Add user management tools
- Add federation status dashboard
- Add content reporting interface
- Add instance blocking interface

**Files:**
- `client/src/pages/AdminPage.tsx` (refactor)
- `client/src/components/ModerationQueue.tsx` (new)
- `client/src/components/UserManagement.tsx` (new)
- `client/src/components/FederationDashboard.tsx` (new)
- `client/src/components/InstanceSettings.tsx` (new)

**Tests:** Admin functionality, moderation, user management

---

### WP-214: Frontend Test Infrastructure

**Scope:** Set up comprehensive frontend testing (WP-131 from roadmap)

**Tasks:**
- Set up React Testing Library (may already exist, enhance)
- Create test utilities and helpers
- Add component test templates
- Set up visual regression testing (if applicable)
- Add E2E testing setup (Playwright/Cypress)
- Create test data factories
- Add accessibility testing (axe-core)
- Document testing patterns

**Files:**
- `client/src/test-utils/` (new directory or enhance)
- `client/vitest.config.ts` (enhance)
- Test files for all components

**Tests:** Test infrastructure itself

---

### WP-215: Component Documentation

**Scope:** Document all components and design system (WP-132 from roadmap)

**Tasks:**
- Create component documentation (Storybook or similar)
- Document design system usage
- Add code examples for all components
- Document accessibility features
- Create style guide
- Document component API/props
- Add usage guidelines

**Files:**
- `client/src/design-system/README.md` (enhance)
- Component documentation files
- `client/STORYBOOK.md` (if using Storybook)

**Tests:** Documentation accuracy

---

## GDPR and DSA Compliance (WP-300 Series)

### WP-300: Data Export Functionality

**Scope:** Allow users to export all their data (GDPR Article 15)

**Tasks:**
- Create backend endpoint `/users/me/export` that returns all user data in JSON format
- Create frontend UI in Settings page for data export
- Include all user data: profile, events, comments, attendance, likes, follows, etc.
- Add export button with confirmation
- Generate downloadable JSON file
- Show export status and progress

**Files:**
- `src/profile.ts` or new file - Backend export endpoint
- `client/src/components/DataExportSettings.tsx` (new)
- `client/src/pages/SettingsPage.tsx` - Add data export section
- `client/src/hooks/queries.ts` - Add export query/mutation

**Tests:** Data export endpoint, export UI, data completeness

---

### WP-301: Account Deletion Enhancement

**Scope:** Ensure account deletion is fully functional and GDPR compliant

**Tasks:**
- Verify backend `/profile` DELETE endpoint works correctly
- Ensure all user data is properly deleted (cascade deletes)
- Add confirmation flow with clear warnings
- Show what data will be deleted
- Add grace period option (optional, for GDPR)
- Handle federated user deletion properly
- Add deletion confirmation email (optional)

**Files:**
- `src/profile.ts` - Enhance DELETE endpoint if needed
- `client/src/components/AccountSettings.tsx` - Enhance deletion UI
- Database schema - Verify cascade deletes

**Tests:** Account deletion, data removal, federated deletion

---

### WP-302: Terms of Service and Privacy Policy Pages

**Scope:** Create ToS and Privacy Policy pages (DSA requirement)

**Tasks:**
- Create Terms of Service page
- Create Privacy Policy page
- Include information about:
  - Data collection and usage
  - Cookie usage
  - Third-party services
  - User rights (GDPR)
  - Content moderation policies
  - Dispute resolution
- Add links in footer
- Add acceptance checkbox during signup
- Store acceptance timestamp

**Files:**
- `client/src/pages/TermsOfServicePage.tsx` (new)
- `client/src/pages/PrivacyPolicyPage.tsx` (new)
- `client/src/components/Footer.tsx` (new or enhance)
- `client/src/pages/LoginPage.tsx` - Add ToS acceptance
- Backend: Store ToS acceptance in user profile

**Tests:** ToS/Privacy pages, acceptance flow, footer links

---

### WP-303: Content Flagging and Reporting System

**Scope:** Allow users to flag illegal/non-ToC compliant content (DSA requirement)

**Tasks:**
- Create report/flag UI component
- Add "Report" button to events, comments, user profiles
- Create report form with categories:
  - Illegal content
  - Hate speech
  - Harassment
  - Spam
  - Copyright violation
  - Other (with text field)
- Create backend endpoint for reports
- Store reports in database
- Add admin interface for reviewing reports (WP-213)
- Send confirmation to reporter
- Handle anonymous reports (if allowed)

**Files:**
- `client/src/components/ReportContentModal.tsx` (new)
- `client/src/components/ReportButton.tsx` (new)
- `client/src/pages/EventDetailPage.tsx` - Add report button
- `client/src/pages/UserProfilePage.tsx` - Add report button
- `client/src/components/CommentList.tsx` - Add report button
- `src/moderation.ts` - Add report endpoint
- Database: Verify Report model exists

**Tests:** Report submission, report categories, admin review

---

### WP-304: Moderation Practices and Transparency

**Scope:** Display moderation practices and ToC compliance info (DSA requirement)

**Tasks:**
- Create Moderation Practices page explaining:
  - What content is allowed/prohibited
  - How moderation works
  - Appeal process
  - Transparency reports (if applicable)
- Add link in footer and About page
- Display moderation status on content (if applicable)
- Show moderation history for admins

**Files:**
- `client/src/pages/ModerationPracticesPage.tsx` (new)
- `client/src/pages/AboutPage.tsx` - Add moderation link
- `client/src/components/Footer.tsx` - Add moderation link
- `client/src/components/ModerationBadge.tsx` (new, if needed)

**Tests:** Moderation practices page, links, content display

---

### WP-305: Redress Mechanism (Appeal Process)

**Scope:** Implement appeal/redress mechanism for moderation decisions (DSA requirement)

**Tasks:**
- Create appeal submission form
- Allow users to appeal moderation decisions (content removal, account suspension)
- Create backend endpoint for appeals
- Store appeals in database
- Add admin interface for reviewing appeals
- Send notifications about appeal status
- Provide clear timeline for appeal resolution
- Document appeal process in Moderation Practices page

**Files:**
- `client/src/components/AppealModal.tsx` (new)
- `client/src/pages/AppealsPage.tsx` (new, for users to view their appeals)
- `client/src/pages/ModerationPracticesPage.tsx` - Add appeal info
- `src/moderation.ts` - Add appeal endpoints
- Database: Add Appeal model if needed

**Tests:** Appeal submission, appeal review, notifications

---

## Pre-Launch Essentials (WP-400 Series)

### WP-400: SEO Optimization

**Scope:** Ensure proper SEO for public pages

**Tasks:**
- Add proper meta tags to all pages
- Add Open Graph tags
- Add Twitter Card tags
- Create sitemap.xml
- Create robots.txt
- Add structured data (JSON-LD) for events
- Optimize page titles and descriptions
- Add canonical URLs

**Files:**
- `client/src/lib/seo.ts` (enhance)
- `client/index.html` - Meta tags
- `client/public/sitemap.xml` (new)
- `client/public/robots.txt` (new)
- All page components - Add SEO metadata

**Tests:** Meta tags, structured data validation, sitemap

---

### WP-401: Performance Optimization

**Scope:** Optimize frontend performance for launch

**Tasks:**
- Implement code splitting
- Optimize bundle size
- Add lazy loading for images
- Optimize font loading
- Add service worker for offline support (optional)
- Minimize API calls
- Add request caching
- Optimize re-renders

**Files:**
- `client/vite.config.ts` - Build optimization
- All components - Performance optimizations
- `client/src/lib/api-client.ts` - Caching

**Tests:** Bundle size, load times, performance metrics

---

### WP-402: Analytics and Monitoring Setup

**Scope:** Set up analytics and error monitoring

**Tasks:**
- Add privacy-respecting analytics (optional, GDPR compliant)
- Set up error monitoring (Sentry, etc.)
- Add performance monitoring
- Track key user actions (anonymized)
- Set up uptime monitoring
- Add logging for critical errors

**Files:**
- `client/src/lib/analytics.ts` (new)
- `client/src/lib/monitoring.ts` (new)
- Configuration files

**Tests:** Analytics tracking, error reporting

---

### WP-403: Security Headers and CSP

**Scope:** Ensure proper security headers

**Tasks:**
- Verify security headers are set (CSP, HSTS, etc.)
- Test XSS protection
- Test CSRF protection
- Verify HTTPS enforcement
- Add security.txt file
- Review and update CORS settings

**Files:**
- `src/middleware/security.ts` (verify)
- `client/public/.well-known/security.txt` (new)

**Tests:** Security headers, CSP, XSS/CSRF protection

---

### WP-404: Accessibility Audit and Fixes

**Scope:** Comprehensive accessibility audit

**Tasks:**
- Run automated accessibility tests (axe-core, Lighthouse)
- Fix all critical accessibility issues
- Test with screen readers
- Test keyboard navigation
- Verify color contrast ratios
- Add skip links
- Ensure proper heading hierarchy
- Test with various assistive technologies

**Files:**
- All components
- `client/src/lib/accessibility.ts` (new utilities if needed)

**Tests:** Accessibility compliance (WCAG 2.1 AA minimum)

---

### WP-405: Internationalization (i18n) Foundation

**Scope:** Set up i18n infrastructure for future translations

**Tasks:**
- Choose i18n library (react-i18next, etc.)
- Set up translation file structure
- Extract all user-facing strings
- Create translation keys
- Set up language detection
- Add language switcher (optional for launch)
- Document translation process

**Files:**
- `client/src/lib/i18n.ts` (new)
- `client/src/locales/` (new directory)
- All components - Use translation keys

**Tests:** i18n setup, translation loading

---

### WP-406: Legal Pages and Compliance

**Scope:** Add all required legal pages

**Tasks:**
- Terms of Service (WP-302)
- Privacy Policy (WP-302)
- Cookie Policy
- DMCA Policy (if applicable)
- Community Guidelines
- Code of Conduct
- Contact/Support page
- Add all to footer

**Files:**
- `client/src/pages/TermsOfServicePage.tsx` (WP-302)
- `client/src/pages/PrivacyPolicyPage.tsx` (WP-302)
- `client/src/pages/CookiePolicyPage.tsx` (new)
- `client/src/pages/DMCAPolicyPage.tsx` (new, if needed)
- `client/src/pages/CommunityGuidelinesPage.tsx` (new)
- `client/src/pages/CodeOfConductPage.tsx` (new)
- `client/src/pages/ContactPage.tsx` (new)
- `client/src/components/Footer.tsx` - Add all links

**Tests:** All legal pages, footer links

---

## Implementation Priority

### Phase 1: Critical (Pre-Launch Blockers)
- WP-200: Homepage Redesign
- WP-201: Merge Search and Discovery
- WP-300: Data Export
- WP-301: Account Deletion Enhancement
- WP-302: ToS and Privacy Policy
- WP-303: Content Flagging
- WP-304: Moderation Practices
- WP-305: Redress Mechanism
- WP-400: SEO Optimization
- WP-403: Security Headers

### Phase 2: Important (Launch Quality)
- WP-202: About Page Enhancement
- WP-203: Dark Mode Toggle Relocation
- WP-204: Loading States
- WP-205: Error Handling
- WP-206: Mobile Responsive Design
- WP-207: Mobile Navigation
- WP-401: Performance Optimization
- WP-404: Accessibility Audit

### Phase 3: Nice to Have (Post-Launch)
- WP-208: Keyboard Navigation
- WP-209: ARIA Labels
- WP-210: Dark Mode Full Implementation
- WP-211: Map View
- WP-212: Real-time Updates Enhancement
- WP-213: Admin Panel Redesign
- WP-214: Test Infrastructure
- WP-215: Component Documentation
- WP-402: Analytics
- WP-405: i18n Foundation
- WP-406: Additional Legal Pages

## Dependencies

- WP-201 depends on WP-200 (homepage changes)
- WP-203 depends on WP-210 (dark mode)
- WP-213 depends on WP-303 (moderation reports)
- WP-305 depends on WP-304 (redress mechanism)
- WP-406 depends on WP-302 (legal pages)

## Notes

- Each work package should be independently implementable
- All packages should include tests
- Follow existing code style and patterns
- Maintain backward compatibility where possible
- Document any breaking changes
- Update this document as packages are completed

