insert into public.leagues(code, name, status)
values
 ('SBBL', 'Sunday''s Best Basketball League', 'published'),
 ('WBL', 'Weekend Basketball League', 'published'),
 ('TGIFBL', 'Thank God It''s Friday Basketball League', 'published')
on conflict (code) do nothing;

insert into public.review_queue(review_type, payload, status)
values
 ('source_conflict', jsonb_build_object('league','WBL','title','WBL source conflict'), 'pending'),
 ('rule_conflict', jsonb_build_object('league','SBBL','title','SBBL review-required rule'), 'pending'),
 ('stream_risk', jsonb_build_object('league','SBBL','title','Live stream source risk item'), 'pending');
