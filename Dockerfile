FROM nginx:alpine
RUN rm -R /etc/nginx/conf.d
COPY ./secrets.json /var/www/
COPY ./scripts/lib/ /var/www/scripts/lib/
COPY ./scripts/location/last.json /var/www/scripts/location/last.json
COPY ./scripts/update-location /var/www/scripts/update-location
COPY ./dist/ /var/www/dist/
COPY ./nginx.conf /etc/nginx/nginx.template
RUN apk add --update nodejs
RUN ln -s /var/www/scripts/update-location /etc/periodic/hourly/update-location
CMD crond && envsubst \$PORT < /etc/nginx/nginx.template > /etc/nginx/nginx.conf && nginx
