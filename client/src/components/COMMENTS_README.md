# Comment System Components

Documentation for WP-111: Comments and Mentions System implementation.

## Component Architecture

```
CommentList (Top-level container)
├── CommentForm (Main comment input)
│   └── MentionAutocomplete (Suggestion dropdown)
├── CommentThread (For each top-level comment)
│   ├── CommentItem (Comment display)
│   ├── CommentForm (Reply input, shown on demand)
│   │   └── MentionAutocomplete
│   └── CommentThread (Recursive for replies)
│       ├── CommentItem
│       └── ... (up to 3 levels deep)
```

## Components

### CommentList.tsx
**Purpose:** Main container for the entire comment system

**Key Features:**
- Shows comment count
- Renders CommentForm for authenticated users
- Shows SignUpPrompt for unauthenticated users
- Displays empty state when no comments
- Passes handlers down to child components

### CommentThread.tsx
**Purpose:** Displays a single comment with its nested replies

**Key Features:**
- Recursively renders nested replies
- Shows/hides reply form on demand
- Visual indentation with left border for replies
- Limits reply depth to 2 levels (3 total levels)

### CommentItem.tsx
**Purpose:** Displays a single comment with actions

**Key Features:**
- Avatar display
- Author name with link to profile
- Comment content with @mention links
- Delete button for comment owner
- Reply button (hidden at max depth)
- Timestamp display

### CommentForm.tsx
**Purpose:** Reusable form for creating comments and replies

**Key Features:**
- Textarea with mention support
- @mention autocomplete integration
- Submit and cancel buttons
- Clears content after successful submission
- Keyboard navigation for mentions

### MentionAutocomplete.tsx
**Purpose:** Dropdown for @mention suggestions

**Key Features:**
- Avatar display for each suggestion
- Name and username display
- Visual highlighting of active item
- Mouse and keyboard interaction

## Threading Behavior

- **Level 0:** Top-level comments (white background, no indentation)
- **Level 1:** First-level replies (indented with left border, 11px + 4px padding)
- **Level 2:** Second-level replies (further indented with left border)
- **Level 3+:** Not allowed - reply button hidden at level 2

## @Mention System Flow

1. User types `@` followed by characters
2. CommentForm detects mention trigger via regex
3. Fetches user suggestions from `/api/user-search?q=...`
4. MentionAutocomplete displays suggestions (max 5)
5. User navigates with arrow keys or mouse
6. Pressing Enter or clicking inserts `@username`
7. Backend creates `CommentMention` records on submit
8. Display renders mentions as clickable profile links

## Usage Example

```tsx
<CommentList
  comments={event.comments || []}
  currentUserId={user?.id}
  isAuthenticated={!!user}
  onAddComment={handleAddComment}
  onReply={handleReply}
  onDelete={handleDeleteComment}
  isAddingComment={addCommentMutation.isPending}
  onSignUpPrompt={handleSignupPrompt}
/>
```

## Testing

All components have comprehensive test coverage:
- `CommentList.test.tsx` - Container and integration tests
- `CommentForm.test.tsx` - Form submission and mention tests
- `CommentThread.test.tsx` - Threading and recursion tests
- `CommentItem.test.tsx` - Display and action tests  
- `MentionAutocomplete.test.tsx` - Suggestion display tests

Run tests: `npm test`
