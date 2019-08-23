FROM nginx:alpine
RUN rm -R /etc/nginx/conf.d
COPY ./deploy/nginx.conf /etc/nginx/nginx.template
COPY ./dist/ /usr/share/nginx/html
CMD envsubst \$PORT < /etc/nginx/nginx.template > /etc/nginx/nginx.conf && nginx
