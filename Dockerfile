FROM nginx:alpine
RUN rm -R /etc/nginx/conf.d
COPY ./secrets.json /var/www/
COPY ./scripts/ /var/www/scripts/
COPY ./dist/ /var/www/dist/
COPY ./nginx.conf /etc/nginx/nginx.template
RUN rm -Rf /var/www/scripts/build
RUN rm -Rf /var/www/scripts/cities/
RUN rm /var/www/scripts/update-location
RUN apk add --update nodejs
RUN echo "#\!/bin/sh\n/var/www/scripts/update-location\n/var/www/scripts/clean-cdn" > /etc/periodic/hourly/update-location-and-cache
RUN chmod a+x /etc/periodic/hourly/update-location-and-cache
CMD crond && envsubst \$PORT < /etc/nginx/nginx.template > /etc/nginx/nginx.conf && nginx
