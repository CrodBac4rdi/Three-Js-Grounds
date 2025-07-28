-- Run this as postgres superuser
-- sudo -u postgres psql < create_db_user.sql
CREATE USER yourshere WITH PASSWORD 'example' CREATEDB;
CREATE DATABASE showcase_dev OWNER yourshere;
