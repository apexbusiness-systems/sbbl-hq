import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-neutral-200">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        <Link to="/" className="inline-flex items-center gap-2 text-amber-500 hover:text-amber-400 text-sm">
          <ArrowLeft size={16} /> Back to SBBL HQ
        </Link>

        <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
        <p className="text-sm text-neutral-400">Effective Date: April 6, 2026 &middot; Last Updated: April 6, 2026</p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">1. Introduction</h2>
          <p>
            SBBL HQ (&quot;we,&quot; &quot;our,&quot; or &quot;the App&quot;) is operated by Apex Business Systems. This Privacy Policy explains how
            we collect, use, disclose, and safeguard your information when you use our mobile application and website. By using SBBL HQ,
            you consent to the practices described herein.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">2. Information We Collect</h2>
          <h3 className="text-lg font-medium text-neutral-300">2.1 Information You Provide</h3>
          <ul className="list-disc list-inside space-y-1 text-neutral-300">
            <li>Account registration data (name, email address, password)</li>
            <li>Player profile information (display name, headshot photo, league affiliation)</li>
            <li>Payment information (processed securely through Stripe &mdash; we do not store card numbers)</li>
            <li>Support requests and communications</li>
          </ul>
          <h3 className="text-lg font-medium text-neutral-300">2.2 Automatically Collected Information</h3>
          <ul className="list-disc list-inside space-y-1 text-neutral-300">
            <li>Device information (device type, operating system, unique device identifiers)</li>
            <li>Usage data (pages viewed, features used, session duration)</li>
            <li>IP address and approximate location (province/state level only)</li>
            <li>Error and crash reports (via Sentry for app stability improvements)</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">3. How We Use Your Information</h2>
          <ul className="list-disc list-inside space-y-1 text-neutral-300">
            <li>Provide, maintain, and improve the App</li>
            <li>Process payments and manage subscriptions</li>
            <li>Display player profiles, stats, and leaderboards</li>
            <li>Deliver livestream content and enforce access controls</li>
            <li>Send service-related notifications (subscription status, game updates)</li>
            <li>Monitor app performance and diagnose technical issues</li>
            <li>Enforce our Terms of Service and prevent fraud</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">4. Data Sharing &amp; Third Parties</h2>
          <p>We do not sell your personal information. We share data only with:</p>
          <ul className="list-disc list-inside space-y-1 text-neutral-300">
            <li><strong>Supabase</strong> &mdash; Authentication and database hosting</li>
            <li><strong>Stripe</strong> &mdash; Payment processing</li>
            <li><strong>Cloudflare</strong> &mdash; Content delivery, DDoS protection, and edge compute</li>
            <li><strong>Sentry</strong> &mdash; Error tracking and performance monitoring</li>
            <li><strong>Cloudflare Turnstile</strong> &mdash; Bot protection (replaces CAPTCHA)</li>
          </ul>
          <p>Each third-party service processes data under their own privacy policies and applicable data protection laws.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">5. Data Retention</h2>
          <p>
            We retain your account data for as long as your account is active. If you delete your account, we remove your personal
            information within 30 days, except where retention is required by law or for legitimate business purposes (e.g., financial
            records). Anonymized usage analytics may be retained indefinitely.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">6. Data Security</h2>
          <p>
            We implement industry-standard security measures including encrypted connections (TLS), Row-Level Security on our database,
            secure session management, and regular security audits. However, no system is 100% secure, and we cannot guarantee absolute
            security.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">7. Your Rights</h2>
          <p>Depending on your jurisdiction, you may have the right to:</p>
          <ul className="list-disc list-inside space-y-1 text-neutral-300">
            <li>Access and receive a copy of your personal data</li>
            <li>Correct inaccurate personal data</li>
            <li>Request deletion of your personal data</li>
            <li>Withdraw consent for data processing</li>
            <li>Lodge a complaint with a supervisory authority</li>
          </ul>
          <p>To exercise any of these rights, contact us at <a href="mailto:info-outreach@sbbl-hq.icu" className="text-amber-500 hover:underline">info-outreach@sbbl-hq.icu</a>.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">8. Children&apos;s Privacy</h2>
          <p>
            SBBL HQ is not intended for children under 13 years of age. We do not knowingly collect personal information from children
            under 13. If we discover that a child under 13 has provided us with personal data, we will delete it promptly.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy
            in the App and updating the &quot;Last Updated&quot; date. Continued use of the App after changes constitutes acceptance of the
            revised policy.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">10. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy or our data practices, contact us at:<br />
            <a href="mailto:info-outreach@sbbl-hq.icu" className="text-amber-500 hover:underline">info-outreach@sbbl-hq.icu</a>
          </p>
        </section>

        <footer className="pt-8 border-t border-neutral-800 text-center text-sm text-neutral-500">
          &copy; {new Date().getFullYear()} Apex Business Systems. All rights reserved.
        </footer>
      </div>
    </div>
  );
}
