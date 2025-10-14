FROM postgres:16

ENV POSTGRES_USER=admin
ENV POSTGRES_PASSWORD=NYadmin!
ENV POSTGRES_DB=monkeymint

COPY db.sql /docker-entrypoint-initdb.d/00_init_db.sql
COPY data.sql /docker-entrypoint-initdb.d/01_seed_data.sql


EXPOSE 5432
