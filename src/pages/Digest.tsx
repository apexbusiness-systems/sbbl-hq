/**
 * /digest — AI-generated weekly recap per league.
 *
 * Reads /api/public/digest?league=<code>. The worker hosts the generation,
 * caches per (league, week) in ai_weekly_digest, and falls back to a
 * deterministic template when GROQ_API_KEY is absent.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Newspaper, Sparkles } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { LEAGUE_REGISTRY } from '@/lib/leagues';
import { fetchDigest } from '@/lib/api/digest';

export default function DigestPage() {
  const [params, setParams] = useSearchParams();
  const initial = (params.get('league') ?? 'SBBL').toUpperCase();
  const [league, setLeague] = useState(initial);

  const digestQuery = useQuery({
    queryKey: ['digest', league],
    queryFn: () => fetchDigest(league),
    staleTime: 5 * 60_000,
  });

  const digest = digestQuery.data?.digest;

  const changeLeague = (code: string) => {
    setLeague(code);
    setParams({ league: code }, { replace: true });
  };

  return (
    <div className="container py-8 max-w-3xl">
      <div className="mb-6 flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-2">
            <Newspaper className="w-7 h-7 text-primary" /> Weekly Digest
          </h1>
          <p className="text-muted-foreground text-sm">
            A 7-day recap of every league — games, scoring leaders, storylines.
          </p>
        </div>
        <div className="flex bg-secondary p-1 rounded-sm">
          {LEAGUE_REGISTRY.map((l) => (
            <button
              key={l.id}
              onClick={() => changeLeague(l.code)}
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-sm ${
                league === l.code
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {l.shortName}
            </button>
          ))}
        </div>
      </div>

      {digestQuery.isLoading && (
        <div className="panel p-8 text-center text-sm text-muted-foreground">
          Building recap…
        </div>
      )}

      {!digestQuery.isLoading && !digest && (
        <div className="panel p-12 text-center">
          <Newspaper className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-semibold mb-1">No recap available</p>
          <p className="text-sm text-muted-foreground">
            Check back after games have been played this week.
          </p>
        </div>
      )}

      {digest && (
        <article className="panel p-6 space-y-6">
          <header>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-primary mb-2">
              <Sparkles className="w-3 h-3" />
              {digest.model === 'fallback'
                ? 'Auto-Summary'
                : `AI · ${digest.model}`}
              <span className="text-muted-foreground">
                · {digest.week_start} → {digest.week_end}
              </span>
            </div>
            <h2 className="text-2xl font-bold leading-tight">
              {digest.headline}
            </h2>
          </header>
          <p className="text-base leading-relaxed whitespace-pre-wrap">
            {digest.summary}
          </p>
          {(digest.sections ?? []).map((section) => (
            <section key={section.title}>
              <h3 className="font-display uppercase tracking-wider text-sm mb-2 text-muted-foreground">
                {section.title}
              </h3>
              {section.items.length === 0 ? (
                <p className="text-xs text-muted-foreground">None this week.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {section.items.map((item, i) => (
                    <li
                      key={i}
                      className="py-1.5 flex items-center justify-between gap-3 text-sm"
                    >
                      <span>{item.label}</span>
                      {item.value && (
                        <span className="stat-numeral">{item.value}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
          <footer className="text-[11px] text-muted-foreground border-t border-border pt-3">
            Generated {new Date(digest.generated_at).toLocaleString()}.
          </footer>
        </article>
      )}
    </div>
  );
}
