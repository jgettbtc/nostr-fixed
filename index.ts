import type { ClawdbotPluginApi, ClawdbotConfig } from "clawdbot/plugin-sdk";
import { emptyPluginConfigSchema } from "clawdbot/plugin-sdk";

import { nostrPlugin } from "./src/channel.js";
import { setNostrRuntime, getNostrRuntime } from "./src/runtime.js";
import { createNostrProfileHttpHandler } from "./src/nostr-profile-http.js";
import { resolveNostrAccount } from "./src/types.js";
import type { NostrProfile } from "./src/config-schema.js";

const plugin = {
  id: "nostr-fixed",
  name: "Nostr Fixed",
  description: "Same as @clawdbot/nostr but with a few fixes to make it work",
  configSchema: emptyPluginConfigSchema(),
  register(api: ClawdbotPluginApi) {
    setNostrRuntime(api.runtime);
    api.registerChannel({ plugin: nostrPlugin });

    // Register HTTP handler for profile management
    const httpHandler = createNostrProfileHttpHandler({
      getConfigProfile: (accountId: string) => {
        const runtime = getNostrRuntime();
        const cfg = runtime.config.loadConfig() as ClawdbotConfig;
        const account = resolveNostrAccount({ cfg, accountId, channelKey: "nostr-fixed" });
        return account.profile;
      },
      updateConfigProfile: async (accountId: string, profile: NostrProfile) => {
        const runtime = getNostrRuntime();
        const cfg = runtime.config.loadConfig() as ClawdbotConfig;

        // Build the config patch for channels.nostr-fixed.profile
        const channels = (cfg.channels ?? {}) as Record<string, unknown>;
        const nostrConfig = (channels["nostr-fixed"] ?? {}) as Record<string, unknown>;

        const updatedNostrConfig = {
          ...nostrConfig,
          profile,
        };

        const updatedChannels = {
          ...channels,
          "nostr-fixed": updatedNostrConfig,
        };

        await runtime.config.writeConfigFile({
          ...cfg,
          channels: updatedChannels,
        });
      },
      getAccountInfo: (accountId: string) => {
        const runtime = getNostrRuntime();
        const cfg = runtime.config.loadConfig() as ClawdbotConfig;
        const account = resolveNostrAccount({ cfg, accountId, channelKey: "nostr-fixed" });
        if (!account.configured || !account.publicKey) {
          return null;
        }
        return {
          pubkey: account.publicKey,
          relays: account.relays,
        };
      },
      log: api.logger,
    });

    api.registerHttpHandler(httpHandler);
  },
};

export default plugin;