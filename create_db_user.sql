-- Run this as postgres superuser
-- sudo -u postgres psql < create_db_user.sql
CREATE USER bacardi WITH PASSWORD 'Limkahvui11!' CREATEDB;
CREATE DATABASE showcase_dev OWNER bacardi;