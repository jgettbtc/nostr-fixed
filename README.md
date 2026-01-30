# Nostr Fixed (based on @clawdbot/nostr)

Nostr DM channel plugin for Clawdbot using NIP-04 encrypted direct messages.

## Overview

This extension adds Nostr as a messaging channel to Clawdbot. It enables your bot to:

- Receive encrypted DMs from Nostr users
- Send encrypted responses back
- Work with any NIP-04 compatible Nostr client (Damus, Amethyst, etc.)

## Installation

1. Clone this repo:
```bash
cd /path/to/my/clawd/plugins #for example
git clone https://github.com/jgettbtc/nostr-fixed
```

2. Add to your config:
```json
"plugins": {
    "load": {
      "paths": ["/path/to/my/clawd/plugins/nostr-fixed"]
    },
    "entries": {
      "nostr-fixed": {
        "enabled": true
      }
    }
  }
```

## Quick Setup

1. Generate a Nostr keypair (if you don't have one):
   ```bash
   # Using nak CLI
   nak key generate

   # Or use any Nostr key generator
   ```

2. Add to your config:
   ```json
   {
     "channels": {
       "nostr": {
         "privateKey": "${NOSTR_PRIVATE_KEY}",
         "relays": ["wss://relay.damus.io", "wss://nos.lol"]
       }
     }
   }
   ```

3. Set the environment variable:
   ```bash
   export NOSTR_PRIVATE_KEY="nsec1..."  # or hex format
   ```

4. Restart the gateway

## Configuration

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `privateKey` | string | required | Bot's private key (nsec or hex format) |
| `relays` | string[] | `["wss://relay.damus.io", "wss://nos.lol"]` | WebSocket relay URLs |
| `dmPolicy` | string | `"pairing"` | Access control: `pairing`, `allowlist`, `open`, `disabled` |
| `allowFrom` | string[] | `[]` | Allowed sender pubkeys (npub or hex) |
| `enabled` | boolean | `true` | Enable/disable the channel |
| `name` | string | - | Display name for the account |

## Access Control

### DM Policies

- **pairing** (default): Unknown senders receive a pairing code to request access
- **allowlist**: Only pubkeys in `allowFrom` can message the bot
- **open**: Anyone can message the bot (use with caution)
- **disabled**: DMs are disabled

### Example: Allowlist Mode

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}",
      "dmPolicy": "allowlist",
      "allowFrom": [
        "npub1abc...",
        "0123456789abcdef..."
      ]
    }
  }
}
```

## Testing

### Local Relay (Recommended)

```bash
# Using strfry
docker run -p 7777:7777 ghcr.io/hoytech/strfry

# Configure clawdbot to use local relay
"relays": ["ws://localhost:7777"]
```

### Manual Test

1. Start the gateway with Nostr configured
2. Open Damus, Amethyst, or another Nostr client
3. Send a DM to your bot's npub
4. Verify the bot responds

## Protocol Support

| NIP | Status | Notes |
|-----|--------|-------|
| NIP-01 | Supported | Basic event structure |
| NIP-04 | Supported | Encrypted DMs (kind:4) |
| NIP-17 | Planned | Gift-wrapped DMs (v2) |

## Security Notes

- Private keys are never logged
- Event signatures are verified before processing
- Use environment variables for keys, never commit to config files
- Consider using `allowlist` mode in production

## Troubleshooting

### Bot not receiving messages

1. Verify private key is correctly configured
2. Check relay connectivity
3. Ensure `enabled` is not set to `false`
4. Check the bot's public key matches what you're sending to

### Messages not being delivered

1. Check relay URLs are correct (must use `wss://`)
2. Verify relays are online and accepting connections
3. Check for rate limiting (reduce message frequency)

## Changes (nostr-fixed fork)

This fork fixes critical bugs in the original `@clawdbot/nostr` plugin.

### Bug Fixes

#### 1. Subscription Filter Fix (`src/nostr-bus.ts`)

The `subscribeMany` API was being called incorrectly, causing relays to reject the subscription with "provided filter is not an object".

```typescript
// Before (broken) - passed array, got nested [[filter]]
pool.subscribeMany(relays, [{ kinds: [4], "#p": [pk], since }], ...)

// After (working) - pass single filter object, API wraps internally
const filter = { kinds: [4], "#p": [pk], since };
pool.subscribeMany(relays, filter as any, ...)
```

#### 2. Message Dispatch Fix (`src/channel.ts`, `src/nostr-dispatch.ts`)

The original code called `runtime.channel.reply.handleInboundMessage()` which doesn't exist in the clawdbot plugin runtime, causing "handleInboundMessage is not a function" errors.

Created `src/nostr-dispatch.ts` which properly routes messages through clawdbot's reply pipeline:
- Builds standardized inbound context (`Surface`, `Provider`, `From`, `To`, `Body`, `SessionKey`, etc.)
- Uses `finalizeInboundContext()` to normalize the context
- Uses `createReplyDispatcherWithTyping()` to create a dispatcher
- Uses `dispatchReplyFromConfig()` to route through the AI and deliver replies

This mirrors how the telegram plugin's `dispatchTelegramMessage()` works.

### New Files

- `src/nostr-dispatch.ts` - Message dispatch function
- `test-publish-profile.ts` - Test script to publish NIP-01 profile
- `test-subscribe-dms.ts` - Test script to subscribe to DMs

### Renamed

All references changed from `nostr` to `nostr-fixed` to run alongside the original plugin.

### Configuration

This plugin uses `channels.nostr-fixed` instead of `channels.nostr`:

```json
{
  "channels": {
    "nostr-fixed": {
      "privateKey": "${NOSTR_PRIVATE_KEY}",
      "relays": ["wss://relay.damus.io", "wss://nos.lol"]
    }
  }
}
```

## License

MIT
