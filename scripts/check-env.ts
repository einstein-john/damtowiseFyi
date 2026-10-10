import { loadEnv } from "../src/config/env.js";

const env = loadEnv();
console.log("Environment parsed successfully:");
console.log(`  cloudinary folder : ${env.CLOUDINARY_FOLDER}`);
console.log(`  admin ids         : ${env.ADMIN_USER_IDS.length} configured`);
console.log(`  sign-ups allowed  : ${env.ALLOW_SIGNUP}`);
console.log(`  scheduler enabled : ${env.SCHEDULER_ENABLED}`);
console.log(`  deploy hook set   : ${env.VERCEL_DEPLOY_HOOK_URL !== undefined}`);