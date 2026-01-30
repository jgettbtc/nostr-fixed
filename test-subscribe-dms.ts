/**
 * Test script to subscribe to Nostr DMs using nostr-bus.ts
 *
 * Reads config from ~/.clawdbot/clawdbot.json (channels.nostr-fixed)
 * Listens for incoming DMs and prints them to console.
 *
 * Usage:
 *   npx tsx test-subscribe-dms.ts
 *
 * Press Ctrl+C to stop.
 */

import { readFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { nip19 } from "nostr-tools";

// Mock the runtime before importing nostr-bus
import { setNostrRuntime } from "./src/runtime.js";

const testStateDir = join(homedir(), ".clawdbot", "state", "nostr-fixed-test");
mkdirSync(testStateDir, { recursive: true });

setNostrRuntime({
  state: {
    resolveStateDir: () => testStateDir,
  },
} as any);

import { startNostrBus, getPublicKeyFromPrivate } from "./src/nostr-bus.js";

async function main() {
  // Read config from clawdbot.json
  const configPath = join(homedir(), ".clawdbot", "clawdbot.json");
  const config = JSON.parse(readFileSync(configPath, "utf-8"));

  const nostrConfig = config.channels?.["nostr-fixed"];
  if (!nostrConfig) {
    console.error("Error: No channels.nostr-fixed config found in", configPath);
    process.exit(1);
  }

  const privateKey = nostrConfig.privateKey;
  const relays: string[] = nostrConfig.relays || ["wss://relay.damus.io", "wss://nos.lol"];

  const pk = getPublicKeyFromPrivate(privateKey);
  const npub = nip19.npubEncode(pk);

  console.log("=== Nostr DM Subscriber (using nostr-bus) ===");
  console.log("");
  console.log("Public Key (hex):", pk);
  console.log("Public Key (npub):", npub);
  console.log("");
  console.log("Relays:", relays.join(", "));
  console.log("");
  console.log("Starting bus...");
  console.log("(Press Ctrl+C to stop)");
  console.log("");
  console.log("---");

  const bus = await startNostrBus({
    privateKey,
    relays,
    accountId: "test-subscribe",
    onMessage: async (pubkey, text, reply) => {
      const senderNpub = nip19.npubEncode(pubkey);
      const timestamp = new Date().toISOString();

      console.log("");
      console.log(`[${timestamp}]`);
      console.log(`From: ${senderNpub}`);
      console.log(`      (${pubkey})`);
      console.log(`Message: ${text}`);
      console.log("---");

      // Optionally auto-reply (commented out)
      // await reply("Got your message!");
    },
    onError: (error, context) => {
      console.error(`[ERROR] ${context}:`, error.message);
    },
    onConnect: (relay) => {
      console.log(`[CONNECTED] ${relay}`);
    },
    onDisconnect: (relay) => {
      console.log(`[DISCONNECTED] ${relay}`);
    },
    onEose: (relay) => {
      console.log(`[EOSE] End of stored events from: ${relay}`);
      console.log("Now listening for new DMs...");
      console.log("---");
    },
    onMetric: (event) => {
      // Uncomment to see all metrics
      // console.log(`[METRIC] ${event.name}:`, event.value, event.tags || "");
    },
  });

  console.log("Bus started, public key:", bus.publicKey);

  // Handle Ctrl+C gracefully
  process.on("SIGINT", () => {
    console.log("");
    console.log("Shutting down...");
    bus.close();
    process.exit(0);
  });

  // Keep the process running
  await new Promise(() => {});
}

main().catch(console.error);
