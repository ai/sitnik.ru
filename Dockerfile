FROM nginx:alpine
RUN rm -R /etc/nginx/conf.d
COPY ./secrets.json /var/www/
COPY ./location/ /var/www/location/
COPY ./dist/ /var/www/dist/
COPY ./utils/ /var/www/utils/
COPY ./nginx.conf /etc/nginx/nginx.template
RUN apk add --update nodejs
RUN ln -s /var/www/location/update /etc/periodic/15min/update-location
CMD crond && envsubst \$PORT < /etc/nginx/nginx.template > /etc/nginx/nginx.conf && nginx
