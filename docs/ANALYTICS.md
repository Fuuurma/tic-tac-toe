# Analytics Configuration

## Vercel Analytics (Recommended)

Vercel Analytics is free and integrates seamlessly with Next.js.

1. Install: `pnpm add @vercel/analytics`
2. Add to your layout:
   ```ts
   import { Analytics } from "@vercel/analytics/react"
   
   // In RootLayout:
   <body>
     <Analytics />
     ...
   </body>
   ```

3. Deploy to Vercel - analytics will automatically work!

## Google Analytics (Alternative)

1. Sign up at https://analytics.google.com
2. Create a property and get your Measurement ID (G-XXXXXXXXXX)
3. Add to .env.local:
   ```
   NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
   ```
4. Add the GA script to layout.tsx

## Simple Custom Analytics

The app includes a simple analytics hook. Use it to track custom events:

```ts
import { useAnalytics } from "@/app/hooks/useAnalytics"

const { trackEvent } = useAnalytics()
trackEvent("game_start", { mode: "vs_ai", difficulty: "hard" })
```

To enable custom analytics, set up a simple API endpoint or use a service like PostHog.
