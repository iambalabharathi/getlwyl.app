# getlwyl.app

Website for LWYL (Skywarel): home, privacy policy and support. Plain HTML/CSS, no build step — Hostinger deploys this repo into `public_html` as is.

- `index.html` — one-pager
- `privacy/` — privacy policy (App Store Connect › Privacy Policy URL: https://getlwyl.app/privacy/)
- `support/` — support page (App Store Connect › Support URL: https://getlwyl.app/support/)
- `.htaccess` — HTTPS, www → bare domain, 404

Later: `.well-known/apple-app-site-association` for shared-workout links (served as JSON, no redirects).
