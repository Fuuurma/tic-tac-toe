# One shared localStorage guard

The four persisting modules (identity, preferences, onboarding, i18n/language) used to carry byte-identical try/catch guards around the `window.localStorage` accessor; they now share `getBrowserStorage()` in `src/lib/storage.ts`. Every caller treats `null` as "do not persist", so one shared answer is safe — the only way the copies could differ is a bug in one of them, and the accessor has to sit inside the try because private-mode and policy-disabled browsers throw from the accessor itself.
