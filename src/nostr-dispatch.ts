/**
 * Nostr message dispatch - routes inbound DMs through clawdbot's reply pipeline
 */

import type { ClawdbotConfig, PluginRuntime } from "clawdbot/plugin-sdk";

export interface NostrInboundMessage {
  /** Plugin runtime for accessing clawdbot APIs */
  runtime: PluginRuntime;
  /** Bot's account ID */
  accountId: string;
  /** Bot's public key (hex) */
  botPubkey: string;
  /** Sender's public key (hex) */
  senderPubkey: string;
  /** Message text */
  text: string;
  /** Function to send reply back to sender */
  reply: (text: string) => Promise<void>;
  /** Optional logger */
  log?: {
    debug?: (msg: string) => void;
    info?: (msg: string) => void;
    warn?: (msg: string) => void;
    error?: (msg: string) => void;
  };
}

/**
 * Dispatch an inbound Nostr DM through clawdbot's message pipeline.
 *
 * This builds the standardized inbound context and routes it through
 * the reply dispatcher, which handles agent routing, AI response
 * generation, and delivers the reply via the provided callback.
 */
export async function dispatchNostrMessage(params: NostrInboundMessage): Promise<void> {
  const { runtime, accountId, botPubkey, senderPubkey, text, reply, log } = params;

  // Build inbound context for clawdbot's message pipeline
  const inboundCtx = runtime.channel.reply.finalizeInboundContext({
    // Channel identification
    Surface: "nostr-fixed",
    Provider: "nostr-fixed",
    AccountId: accountId,

    // Message participants
    From: senderPubkey,
    To: botPubkey,
    SenderId: senderPubkey,

    // Message content
    Body: text,
    RawBody: text,

    // Routing
    ChatType: "direct",
    SessionKey: `nostr-fixed:${senderPubkey}`,

    // Permissions
    CommandAuthorized: true,

    // Metadata
    Timestamp: Math.floor(Date.now() / 1000),
  });

  const cfg = runtime.config.loadConfig() as ClawdbotConfig;

  // Create dispatcher with delivery callback
  const { dispatcher } = runtime.channel.reply.createReplyDispatcherWithTyping({
    deliver: async (payload: { text?: string }) => {
      if (payload.text) {
        await reply(payload.text);
      }
    },
    onError: (err: Error) => {
      log?.error?.(`[${accountId}] Reply delivery error: ${err.message}`);
    },
  });

  // Dispatch through the reply pipeline
  await runtime.channel.reply.dispatchReplyFromConfig({
    ctx: inboundCtx,
    cfg,
    dispatcher,
  });
}
