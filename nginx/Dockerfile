FROM nginx:1.27-alpine
RUN apk add --no-cache openssl

WORKDIR /etc/nginx

# Verzeichnis anlegen **vor** openssl
RUN mkdir -p /etc/nginx/certs && \
    openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
      -keyout /etc/nginx/certs/dev.key \
      -out    /etc/nginx/certs/dev.crt \
      -subj "/CN=localhost"

COPY conf.d/ /etc/nginx/conf.d/
EXPOSE 443
CMD ["nginx", "-g", "daemon off;"]
