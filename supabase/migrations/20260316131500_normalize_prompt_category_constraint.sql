alter table public.prompts
drop constraint if exists prompts_prompt_category_check;

alter table public.prompts
add constraint prompts_prompt_category_check
check (
  prompt_category in (
    'explicit_recommendation',
    'problem_solution',
    'ingredient_education',
    'product_interaction'
  )
);
