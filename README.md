# tracking_-working_daily
Dùng để tracking hiệu suất làm việc

## Supabase config

App đọc/ghi bảng `sessions` trên Supabase project `https://yduzszsybrbugjmlrceh.supabase.co`.

Public anon key đã được cấu hình mặc định trong `app.js`. Có thể override trước `app.js` nếu cần đổi project/key:

```html
<script>
  window.SUPABASE_ANON_KEY = 'your-supabase-anon-key';
</script>
```

Hoặc set tạm trong browser để test:

```js
localStorage.setItem('supabase-anon-key', 'your-supabase-anon-key');
```

## Daily review schema

Daily Review đồng bộ qua bảng `daily_reviews`. Tạo bảng này trong Supabase SQL Editor trước khi dùng:

```sql
create table if not exists public.daily_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  review_date date not null,
  created_today text,
  waste_time text,
  tomorrow_change text,
  satisfaction integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, review_date)
);
```
