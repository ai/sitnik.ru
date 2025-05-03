FROM cgr.dev/chainguard/nginx:latest

COPY ./nginx.conf /etc/nginx/nginx.conf
COPY ./dist/ /var/www/
