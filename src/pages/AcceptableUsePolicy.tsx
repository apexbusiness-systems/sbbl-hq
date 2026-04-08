const AcceptableUsePolicyPage = () => (
  <div className="min-h-screen">
    <div className="container max-w-3xl py-10 space-y-6">
      <h1 className="font-display text-3xl font-bold">Acceptable Use Policy</h1>
      <p className="text-sm text-muted-foreground">LampStand services and software are proprietary to APEX Business Systems LTD. You receive a limited, non-transferable end-user license.</p>
      <section className="space-y-2 text-sm">
        <h2 className="font-display text-xl">Prohibited actions</h2>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>No scraping, reverse engineering, or automated extraction without written approval.</li>
          <li>No abuse, harassment, hateful conduct, or attempts to bypass safety controls.</li>
          <li>No unauthorized resale, sublicensing, or redistribution of proprietary assets.</li>
        </ul>
      </section>
      <p className="text-xs text-muted-foreground">UNCERTAIN LEGAL REVIEW REQUIRED: Jurisdiction-specific language and enforcement remedies require final counsel review before production legal sign-off.</p>
    </div>
  </div>
);

export default AcceptableUsePolicyPage;
