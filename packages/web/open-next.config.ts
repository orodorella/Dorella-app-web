import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// The current application does not use ISR/revalidate, so it does not require
// an R2 incremental-cache binding. Add one only when persistent ISR is added.
export default defineCloudflareConfig({});
