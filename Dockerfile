# Web server to serve web client for staging and pull request previews

FROM cgr.dev/chainguard/nginx:latest

COPY ./nginx.conf /etc/nginx/nginx.conf
COPY ./dist/ /var/www/
