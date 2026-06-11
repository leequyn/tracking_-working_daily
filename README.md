# tracking_-working_daily
Dùng để tracking hiệu suất làm việc

## Supabase config

App đọc/ghi bảng `sessions` trên Supabase project `https://yduzszsyrbbugjmlrceh.supabase.co`.

Cần inject public anon key trước `app.js`, ví dụ:

```html
<script>
  window.SUPABASE_ANON_KEY = 'your-supabase-anon-key';
</script>
```

Hoặc set tạm trong browser để test:

```js
localStorage.setItem('supabase-anon-key', 'your-supabase-anon-key');
```
