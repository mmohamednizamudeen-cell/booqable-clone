-- Behaviour tests for schema.sql. Run as a superuser on an empty database after loading schema.sql:
--   psql -d <db> -f schema.sql && psql -d <db> -At -f schema_test.sql
-- Expected results are in architecture.md, "Schema test results".
\set ON_ERROR_STOP 0
\set QUIET 1
-- fixture ids
insert into orgs (id,name,slug,currency) values
 ('00000000-0000-0000-0000-00000000000a','Org A','org-a','USD'),
 ('00000000-0000-0000-0000-00000000000b','Org B','org-b','EUR');
set role app_user;
select set_config('app.org_id','00000000-0000-0000-0000-00000000000a',false);
insert into products (id,org_id,name,slug,product_type,tracking,price_type,price_period,buffer_before_seconds,buffer_after_seconds)
 values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','Camera','camera','rental','individual','flat','day',0,3600),
        ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000a','Chair','chair','rental','bulk','flat','day',0,0);
insert into product_variants (id,org_id,product_id,base_price_cents) values
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000001',5000),
 ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-000000000002',300);
insert into stock_items (id,org_id,variant_id,identifier) values
 ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-000000000001','CAM-1'),
 ('30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-000000000001','CAM-2');
-- 10 chairs, plus 5 temporary chairs on Jan 10-12 only
insert into stock_batches (org_id,variant_id,quantity) values ('00000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-000000000002',10);
insert into stock_batches (org_id,variant_id,quantity,kind,available_from,available_till) values
 ('00000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-000000000002',5,'temporary','2027-01-10','2027-01-12');
insert into customers (id,org_id,number,name) values ('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a',1,'Ann');
insert into orders (id,org_id,number,status,customer_id,currency,starts_at,stops_at) values
 ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a',1,'reserved','40000000-0000-0000-0000-000000000001','USD','2027-01-10 09:00Z','2027-01-11 09:00Z'),
 ('50000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000a',2,'reserved',null,'USD','2027-01-11 09:30Z','2027-01-12 09:00Z');
-- order 1: camera (1h after-buffer => reserved till 10:00 on the 11th) + 12 chairs
insert into plannings (id,org_id,kind,order_id,variant_id,quantity,starts_at,stops_at,reserved_from,reserved_till,holds_stock) values
 ('60000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','order','50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',1,'2027-01-10 09:00Z','2027-01-11 09:00Z','2027-01-10 09:00Z','2027-01-11 10:00Z',true),
 ('60000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000a','order','50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002',12,'2027-01-10 09:00Z','2027-01-11 09:00Z','2027-01-10 09:00Z','2027-01-11 09:00Z',true);
insert into stock_item_plannings (org_id,planning_id,stock_item_id,reserved_from,reserved_till,holds_stock) values
 ('00000000-0000-0000-0000-00000000000a','60000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','2027-01-10 09:00Z','2027-01-11 10:00Z',true);

\echo 'T1 cameras free Jan 11 09:30-Jan 12 (expect 1: CAM-1 still in its 1h buffer)'
select variant_free_quantity('20000000-0000-0000-0000-000000000001',null,'2027-01-11 09:30Z','2027-01-12 09:00Z');
\echo 'T2 cameras free Jan 11 10:00 onward (expect 2: buffer over)'
select variant_free_quantity('20000000-0000-0000-0000-000000000001',null,'2027-01-11 10:00Z','2027-01-12 09:00Z');
\echo 'T3 chairs free Jan 10 09:00-Jan 11 09:00 (expect 3: 15 capacity incl temp - 12)'
select variant_free_quantity('20000000-0000-0000-0000-000000000002',null,'2027-01-10 09:00Z','2027-01-11 09:00Z');
\echo 'T4 chairs free Jan 9 - Jan 11 (expect 3: the tightest moment in the window)'
select variant_free_quantity('20000000-0000-0000-0000-000000000002',null,'2027-01-09 00:00Z','2027-01-11 09:00Z');
\echo 'T5 chairs free Jan 12-13 (expect 10: temporary stock gone, nothing held)'
select variant_free_quantity('20000000-0000-0000-0000-000000000002',null,'2027-01-12 00:00Z','2027-01-13 00:00Z');
\echo 'T6 excluding order 1 itself, chairs Jan 10-11 (expect 15)'
select variant_free_quantity('20000000-0000-0000-0000-000000000002',null,'2027-01-10 09:00Z','2027-01-11 09:00Z','50000000-0000-0000-0000-000000000001');

\echo 'T7 double-book CAM-1 for order 2 inside its buffer (expect exclusion violation)'
insert into plannings (id,org_id,kind,order_id,variant_id,quantity,starts_at,stops_at,reserved_from,reserved_till,holds_stock) values
 ('60000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000000a','order','50000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001',1,'2027-01-11 09:30Z','2027-01-12 09:00Z','2027-01-11 09:30Z','2027-01-12 10:00Z',true);
insert into stock_item_plannings (org_id,planning_id,stock_item_id,reserved_from,reserved_till,holds_stock) values
 ('00000000-0000-0000-0000-00000000000a','60000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000001','2027-01-11 09:30Z','2027-01-12 10:00Z',true);
\echo 'T8 same unit, back to back after the buffer (expect success)'
insert into stock_item_plannings (org_id,planning_id,stock_item_id,reserved_from,reserved_till,holds_stock) values
 ('00000000-0000-0000-0000-00000000000a','60000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000001','2027-01-11 10:00Z','2027-01-12 10:00Z',true);
select 'T8 rows', count(*) from stock_item_plannings;
\echo 'T9 a draft (holds_stock=false) may overlap freely (expect success)'
update stock_item_plannings set holds_stock=false where planning_id='60000000-0000-0000-0000-000000000003';
insert into stock_item_plannings (org_id,planning_id,stock_item_id,reserved_from,reserved_till,holds_stock) values
 ('00000000-0000-0000-0000-00000000000a','60000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','2027-01-10 09:00Z','2027-01-11 10:00Z',false);
\echo 'T10 change tracking type (expect error)'
update products set tracking='bulk' where id='10000000-0000-0000-0000-000000000001';

\echo '--- tenant B'
select set_config('app.org_id','00000000-0000-0000-0000-00000000000b',false);
\echo 'T11 org B sees org A products (expect 0)'
select count(*) from products;
\echo 'T12 org B sees orgs (expect 1, itself)'
select count(*) from orgs;
\echo 'T13 org B inserts a row tagged as org A (expect RLS violation)'
insert into customers (org_id,number,name) values ('00000000-0000-0000-0000-00000000000a',9,'Mallory');
\echo 'T14 org B order pointing at org A customer id (expect FK violation)'
insert into orders (org_id,number,status,customer_id,currency) values ('00000000-0000-0000-0000-00000000000b',1,'draft','40000000-0000-0000-0000-000000000001','EUR');
\echo 'T15 no org set at all (expect 0)'
select set_config('app.org_id','',false);
select count(*) from products;
\echo 'T16 reserved order without dates (expect check violation)'
select set_config('app.org_id','00000000-0000-0000-0000-00000000000a',false);
insert into orders (org_id,number,status,currency) values ('00000000-0000-0000-0000-00000000000a',3,'reserved','USD');
reset role;
