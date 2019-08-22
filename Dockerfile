FROM nginx:alpine
RUN rm -R /etc/nginx/conf.d
COPY ./nginx.conf /etc/nginx/nginx.conf
COPY ./dist/ /usr/share/nginx/html
EXPOSE 80
