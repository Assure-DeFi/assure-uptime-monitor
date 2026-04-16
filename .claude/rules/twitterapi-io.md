# twitterapi.io Integration Rules

These rules apply to ALL code that integrates with the twitterapi.io API.

## API Field Naming Convention

The twitterapi.io API uses **camelCase** for all field names. Our codebase MUST match this exactly.

### User Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `userName` | string | Twitter handle (without @) |
| `name` | string | Display name |
| `id` | string | User ID |
| `description` | string | Bio |
| `followers` | number | Follower count |
| `following` | number | Following count |
| `statusesCount` | number | Tweet count |
| `listedCount` | number | List membership count |
| `isBlueVerified` | boolean | Blue checkmark status |
| `createdAt` | string | Account creation (ISO) |
| `profilePicture` | string | Profile image URL |
| `coverPicture` | string | Banner image URL |
| `location` | string | Location text |
| `url` | string | Website URL |

### Tweet Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Tweet ID |
| `text` | string | Tweet content |
| `authorId` | string | Author's user ID |
| `author` | User | Nested user object |
| `createdAt` | string | Tweet timestamp (ISO) |
| `likeCount` | number | Like count |
| `retweetCount` | number | Retweet count |
| `replyCount` | number | Reply count |
| `quoteCount` | number | Quote tweet count |
| `viewCount` | number | Impression count |

## Required Patterns

### Accessing User Fields

```typescript
// CORRECT - use camelCase field names
const handle = user.userName;
const followers = user.followers;
const isVerified = user.isBlueVerified;
const accountAge = new Date(user.createdAt);

// WRONG - snake_case does not exist
const handle = user.username;        // undefined!
const followers = user.followers_count;  // undefined!
const isVerified = user.verified;    // undefined!
```

### Accessing Tweet Fields

```typescript
// CORRECT
const likes = tweet.likeCount;
const retweets = tweet.retweetCount;
const posted = tweet.createdAt;
const authorHandle = tweet.author.userName;

// WRONG
const likes = tweet.like_count;      // undefined!
const retweets = tweet.retweet_count;  // undefined!
```

### Guard Checks

```typescript
// CORRECT - check userName exists
if (!tweet.author?.userName) continue;

// WRONG - username field doesn't exist
if (!tweet.author?.username) continue;  // Always true!
```

## Interface Definitions

The canonical interfaces are in `outreach-bot/src/discovery/types.ts`:
- `TwitterApiUser` - User/author objects
- `TwitterApiTweet` - Tweet objects
- `TwitterApiSearchResponse` - Search endpoint response

Always import from this file. Never create duplicate interfaces.

## Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| `user.username` | API returns `userName` | Use `user.userName` |
| `user.followers_count` | API returns `followers` | Use `user.followers` |
| `user.verified` | API returns `isBlueVerified` | Use `user.isBlueVerified` |
| `tweet.like_count` | API returns `likeCount` | Use `tweet.likeCount` |
| `tweet.created_at` | API returns `createdAt` | Use `tweet.createdAt` |

## Testing

When testing twitterapi.io integration:
1. Log raw API responses to verify field names
2. Check that extracted `userName` is not undefined
3. Verify follower counts are numbers, not undefined

## Related Rules

- See `runtime-data-validation.md` for validating API responses
- See `code-quality.md` for TypeScript standards
