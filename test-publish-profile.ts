/**
 * Test script to publish a real Nostr profile event
 *
 * Reads config from ~/.clawdbot/clawdbot.json
 *
 * Usage:
 *   npx tsx test-publish-profile.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { SimplePool, getPublicKey, nip19 } from "nostr-tools";
import { validatePrivateKey } from "./src/nostr-bus.js";
import { publishProfile, createProfileEvent } from "./src/nostr-profile.js";
import type { NostrProfile } from "./src/config-schema.js";

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
  const relays = nostrConfig.relays || ["wss://relay.damus.io", "wss://nos.lol"];
  const profile: NostrProfile = nostrConfig.profile || {};

  // Validate and convert private key
  let sk: Uint8Array;
  try {
    sk = validatePrivateKey(privateKey);
  } catch (err) {
    console.error("Error: Invalid private key format");
    console.error((err as Error).message);
    process.exit(1);
  }

  const pk = getPublicKey(sk);
  const npub = nip19.npubEncode(pk);

  console.log("=== Nostr Profile Publisher Test ===");
  console.log("");
  console.log("Public Key (hex):", pk);
  console.log("Public Key (npub):", npub);
  console.log("");
  console.log("Relays:", relays.join(", "));
  console.log("");

  console.log("Profile to publish:");
  console.log(JSON.stringify(profile, null, 2));
  console.log("");

  // Create the event first to show what will be published
  const event = createProfileEvent(sk, profile);
  console.log("Event ID:", event.id);
  console.log("Event created_at:", new Date(event.created_at * 1000).toISOString());
  console.log("");

  // Publish to relays
  console.log("Publishing to relays...");
  const pool = new SimplePool();

  try {
    const result = await publishProfile(pool, sk, relays, profile);

    console.log("");
    console.log("=== Results ===");
    console.log("Event ID:", result.eventId);
    console.log("Created at:", new Date(result.createdAt * 1000).toISOString());
    console.log("");

    if (result.successes.length > 0) {
      console.log("✓ Successes:");
      for (const relay of result.successes) {
        console.log(`  - ${relay}`);
      }
    }

    if (result.failures.length > 0) {
      console.log("");
      console.log("✗ Failures:");
      for (const { relay, error } of result.failures) {
        console.log(`  - ${relay}: ${error}`);
      }
    }

    console.log("");
    console.log("You can view this profile at:");
    console.log(`  https://njump.me/${npub}`);
    console.log(`  https://primal.net/p/${npub}`);
    console.log(`  https://snort.social/p/${npub}`);

  } catch (err) {
    console.error("Error publishing profile:", err);
    process.exit(1);
  } finally {
    // Give time for WebSocket messages to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    pool.close(relays);
  }
}

main().catch(console.error);
