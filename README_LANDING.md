# Operator Landing Deployment

1. Run `npm run typecheck && npm run build` to validate the `/operators` route bundle.
2. Deploy with `npm run cf:deploy` (or `npm run cf:deploy:staging` for staging verification).
3. Open `https://<your-domain>/operators` and verify CTA opens Calendly modal + Escape/backdrop close behavior.
