# tracking_-working_daily
Dùng để tracking hiệu suất làm việc

## Supabase config

App đọc/ghi bảng `sessions` trên Supabase project `https://yduzszsyrbbugjmlrceh.supabase.co`.

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
