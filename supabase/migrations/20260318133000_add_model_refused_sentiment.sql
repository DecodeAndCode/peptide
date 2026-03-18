alter table public.prompts
drop constraint if exists prompts_sentiment_check;

alter table public.prompts
add constraint prompts_sentiment_check
check (
  sentiment is null
  or sentiment in ('positive', 'neutral', 'negative', 'not_mentioned', 'model_refused')
);
