# معلّم الإنجليزية الصوتي

## التجربة على الكمبيوتر
```
npm install
ANTHROPIC_API_KEY=sk-ant-... npm start
```
ثم افتح http://localhost:3000 في Chrome.

## النشر على Render (مجاني)
1. ارفع هذا المجلد إلى مستودع GitHub.
2. في Render: New ← Web Service ← اختر المستودع.
3. Build Command: `npm install` ، Start Command: `npm start`
4. من Environment أضف:
   - ANTHROPIC_API_KEY = مفتاحك
   - ACCESS_CODE = كلمة سر من اختيارك (تحمي مفتاحك من الغرباء)
5. افتح الرابط في Chrome على الهاتف. سيطلب كلمة السر في أول مرة.

المفتاح يبقى على الخادم فقط ولا يظهر في الصفحة.
