# Federation Error Handling (WP-019)

This document describes the enhanced error handling and monitoring features for ActivityPub federation in Constellate.

## Overview

Constellate now includes comprehensive error handling for ActivityPub activity delivery with automatic retry, dead letter queue, and admin monitoring capabilities.

## Features

### 1. Automatic Retry with Exponential Backoff

All activity deliveries now use automatic retry with exponential backoff:
- Default: 3 retry attempts
- Backoff: 1s, 2s, 4s, 8s, etc. (max 1 hour)
- Retries happen automatically for failed deliveries

### 2. Dead Letter Queue

Failed deliveries are automatically recorded in a dead letter queue with:
- Full activity payload
- Error details and status codes
- Retry attempt tracking
- Automatic retry scheduling
- Manual retry and discard options

#### Dead Letter Queue Statuses

- `PENDING` - Awaiting retry
- `RETRYING` - Currently being retried
- `FAILED` - All retries exhausted
- `DISCARDED` - Manually discarded by admin

### 3. Structured Error Logging

All federation errors are logged with structured data including:
- Timestamp
- Activity ID and type
- Target inbox URL
- Error message and code
- HTTP status code (if applicable)

Example log entry:
```json
{
  "timestamp": "2024-12-09T02:30:00.000Z",
  "inboxUrl": "https://remote.example.com/inbox",
  "activityId": "https://local.example.com/activities/123",
  "activityType": "Create",
  "error": {
    "message": "HTTP 500: Internal Server Error",
    "code": "500",
    "statusCode": 500
  }
}
```

### 4. Background Queue Processing

The `processDeadLetterQueue()` function processes pending deliveries:
- Runs in batches of 50
- Respects exponential backoff schedules
- Automatically marks deliveries as failed after max attempts
- Can be called manually or scheduled via cron

Example usage:
```typescript
import { processDeadLetterQueue } from './services/ActivityDelivery.js'

// Process pending deliveries
await processDeadLetterQueue()
```

## Admin API Endpoints

All endpoints require admin authentication.

### GET /api/admin/failed-deliveries

List failed deliveries with filtering and pagination.

**Query Parameters:**
- `page` (number, optional) - Page number (default: 1)
- `limit` (number, optional) - Results per page (default: 20, max: 100)
- `status` (string, optional) - Filter by status: PENDING, RETRYING, FAILED, DISCARDED
- `inboxUrl` (string, optional) - Filter by inbox URL (partial match)

**Response:**
```json
{
  "deliveries": [
    {
      "id": "delivery-123",
      "activityId": "https://example.com/activities/456",
      "activityType": "Create",
      "inboxUrl": "https://remote.com/inbox",
      "userId": "user-789",
      "lastError": "Connection timeout",
      "lastErrorCode": "ETIMEDOUT",
      "lastAttemptAt": "2024-12-09T02:30:00.000Z",
      "attemptCount": 2,
      "maxAttempts": 3,
      "nextRetryAt": "2024-12-09T02:35:00.000Z",
      "status": "PENDING",
      "createdAt": "2024-12-09T02:20:00.000Z",
      "resolvedAt": null,
      "resolvedBy": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

### GET /api/admin/federation-stats

Get federation health statistics.

**Response:**
```json
{
  "summary": {
    "pending": 5,
    "retrying": 2,
    "failed": 10,
    "discarded": 3,
    "total": 20
  },
  "domainStats": [
    {
      "domain": "remote1.example.com",
      "success": 100,
      "failed": 5
    },
    {
      "domain": "remote2.example.com",
      "success": 50,
      "failed": 2
    }
  ]
}
```

### POST /api/admin/failed-deliveries/:id/retry

Manually retry a failed delivery.

**Response:**
```json
{
  "success": true
}
```

### POST /api/admin/failed-deliveries/:id/discard

Discard a failed delivery (mark as resolved without retry).

**Response:**
```json
{
  "success": true
}
```

## Database Schema

### FailedDelivery Model

```prisma
model FailedDelivery {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Activity details
  activityId   String
  activityType String
  activity     Json

  // Delivery details
  inboxUrl String
  userId   String

  // Error tracking
  lastError     String?
  lastErrorCode String?
  lastAttemptAt DateTime?

  // Retry management
  attemptCount Int                   @default(0)
  maxAttempts  Int                   @default(3)
  nextRetryAt  DateTime?
  status       FailedDeliveryStatus  @default(PENDING)

  // Resolution
  resolvedAt   DateTime?
  resolvedBy   String?

  @@index([status, nextRetryAt])
  @@index([userId])
  @@index([inboxUrl])
  @@index([createdAt])
}

enum FailedDeliveryStatus {
  PENDING
  RETRYING
  FAILED
  DISCARDED
}
```

## Usage Examples

### Manual Retry

```typescript
import { retryFailedDelivery } from './services/ActivityDelivery.js'

// Retry a specific failed delivery
const success = await retryFailedDelivery('delivery-123')
if (success) {
  console.log('Delivery succeeded')
} else {
  console.log('Delivery failed again')
}
```

### Discard Failed Delivery

```typescript
import { discardFailedDelivery } from './services/ActivityDelivery.js'

// Discard a delivery (e.g., if the remote server is permanently down)
await discardFailedDelivery('delivery-123', 'admin-user-id')
```

### Custom Delivery with Retry

```typescript
import { deliverWithRetry } from './services/ActivityDelivery.js'

const activity = {
  id: 'https://example.com/activities/123',
  type: 'Create',
  actor: 'https://example.com/users/alice',
  object: { /* ... */ }
}

const user = {
  id: 'user-123',
  username: 'alice',
  privateKey: '...'
}

// Deliver with 5 retries and record failures
const success = await deliverWithRetry(
  activity,
  'https://remote.com/inbox',
  user,
  5,  // maxRetries
  true // recordFailure
)
```

## Monitoring Recommendations

1. **Set up a cron job** to run `processDeadLetterQueue()` every 5-10 minutes
2. **Monitor the failed delivery count** - a sudden spike may indicate issues
3. **Review domain statistics** regularly to identify problematic instances
4. **Set up alerts** for when failed delivery count exceeds a threshold
5. **Periodically review and discard** old failed deliveries that are no longer relevant

## Configuration

All retry behavior is configurable in the service:

- `maxAttempts`: Maximum retry attempts (default: 3)
- `baseDelay`: Initial retry delay in ms (default: 1000)
- `maxDelay`: Maximum retry delay in ms (default: 3600000 = 1 hour)

## Error Codes

Common error codes you may encounter:

- `NO_PRIVATE_KEY` - User has no private key for signing
- `DECRYPTION_FAILED` - Failed to decrypt private key
- `MAX_RETRIES_EXCEEDED` - All retry attempts failed
- `NETWORK_ERROR` - Network connection error
- `500`, `502`, `503`, `504` - HTTP server errors from remote instance

## Best Practices

1. **Don't manually delete from database** - Use the discard endpoint instead
2. **Investigate patterns** - Multiple failures to the same domain may indicate a blocklist
3. **Respect retry schedules** - Don't manually retry too frequently
4. **Monitor resource usage** - Large dead letter queues can impact performance
5. **Clean up old records** - Consider archiving or deleting old resolved deliveries
